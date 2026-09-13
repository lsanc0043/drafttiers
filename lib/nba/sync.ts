import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseNbaCatalog, runNbaPythonSync } from "@/lib/nba/python";
import { chunk, dedupePlayers, summarizeUpsert } from "@/lib/nba/upsert";
import type { NbaPlayerInput } from "@/lib/nba/schema";

const SYNC_ID = "nba-players";
const STALE_RUNNING_MS = 5 * 60 * 1000;
const UPSERT_CHUNK_SIZE = 300;

let syncInFlight = false;

export type SyncNbaResult = {
  success: true;
  fetched: number;
  inserted: number;
  updated: number;
  failed: number;
  completedAt: string;
};

export type NbaSyncStatusPayload = {
  status: "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  fetchedCount: number | null;
  insertedCount: number | null;
  updatedCount: number | null;
  failedCount: number | null;
  lastError: string | null;
  playerCount: number;
};

type SyncDeps = {
  prisma: PrismaClient;
  fetchCatalog: () => Promise<unknown>;
  now: () => Date;
};

const defaultDeps: SyncDeps = {
  prisma,
  fetchCatalog: () => runNbaPythonSync(),
  now: () => new Date(),
};

export class SyncInProgressError extends Error {
  constructor() {
    super("An NBA player sync is already running");
    this.name = "SyncInProgressError";
  }
}

export async function getNbaSyncStatus(
  db: PrismaClient = prisma,
): Promise<NbaSyncStatusPayload> {
  const [state, playerCount] = await Promise.all([
    db.nbaSyncState.findUnique({ where: { id: SYNC_ID } }),
    db.player.count(),
  ]);

  return {
    status: state?.status ?? "IDLE",
    lastStartedAt: state?.lastStartedAt?.toISOString() ?? null,
    lastFinishedAt: state?.lastFinishedAt?.toISOString() ?? null,
    lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
    fetchedCount: state?.fetchedCount ?? null,
    insertedCount: state?.insertedCount ?? null,
    updatedCount: state?.updatedCount ?? null,
    failedCount: state?.failedCount ?? null,
    lastError: state?.lastError ?? null,
    playerCount,
  };
}

export async function syncNbaPlayers(deps: Partial<SyncDeps> = {}): Promise<SyncNbaResult> {
  const { prisma: db, fetchCatalog, now } = { ...defaultDeps, ...deps };

  if (syncInFlight) {
    throw new SyncInProgressError();
  }

  syncInFlight = true;
  const startedAt = now();

  try {
    const existingState = await db.nbaSyncState.findUnique({ where: { id: SYNC_ID } });
    if (existingState?.status === "RUNNING" && existingState.lastStartedAt) {
      const age = now().getTime() - existingState.lastStartedAt.getTime();
      if (age < STALE_RUNNING_MS) {
        throw new SyncInProgressError();
      }
    }
    await db.nbaSyncState.upsert({
      where: { id: SYNC_ID },
      update: {
        status: "RUNNING",
        lastStartedAt: startedAt,
        lastError: null,
      },
      create: {
        id: SYNC_ID,
        status: "RUNNING",
        lastStartedAt: startedAt,
      },
    });

    const catalog = parseNbaCatalog(await fetchCatalog());
    const players = dedupePlayers(catalog.players);
    if (players.length === 0) {
      throw new Error("NBA catalog contained no valid players");
    }
    const failed = catalog.parseFailed;
    const result = await persistPlayers(db, players, now());

    const completedAt = now();
    await db.nbaSyncState.update({
      where: { id: SYNC_ID },
      data: {
        status: "SUCCESS",
        lastFinishedAt: completedAt,
        lastSuccessAt: completedAt,
        fetchedCount: players.length,
        insertedCount: result.inserted,
        updatedCount: result.updated,
        failedCount: failed,
        lastError: catalog.indexError ? `Position enrich failed: ${catalog.indexError}` : null,
      },
    });

    return {
      success: true,
      fetched: players.length,
      inserted: result.inserted,
      updated: result.updated,
      failed,
      completedAt: completedAt.toISOString(),
    };
  } catch (error) {
    if (!(error instanceof SyncInProgressError)) {
      const message = error instanceof Error ? error.message : "Unknown NBA sync error";
      try {
        await db.nbaSyncState.upsert({
          where: { id: SYNC_ID },
          update: {
            status: "FAILED",
            lastFinishedAt: now(),
            lastError: message.slice(0, 2000),
          },
          create: {
            id: SYNC_ID,
            status: "FAILED",
            lastFinishedAt: now(),
            lastError: message.slice(0, 2000),
          },
        });
      } catch {
        // Status persist should not hide the original sync error.
      }
    }
    throw error;
  } finally {
    syncInFlight = false;
  }
}

export async function persistPlayers(
  db: PrismaClient,
  players: NbaPlayerInput[],
  syncedAt: Date,
) {
  const existing = await db.player.findMany({ select: { nbaPersonId: true } });
  const existingIds = new Set(existing.map((row) => row.nbaPersonId));
  const summary = summarizeUpsert(
    existingIds,
    players.map((player) => player.nbaPersonId),
  );

  for (const group of chunk(players, UPSERT_CHUNK_SIZE)) {
    const values = group.map((player) => playerInsertValues(player, syncedAt));
    await db.$executeRaw`
      INSERT INTO "Player" (
        "id",
        "nbaPersonId",
        "firstName",
        "lastName",
        "fullName",
        "teamId",
        "teamAbbr",
        "teamName",
        "position",
        "jerseyNumber",
        "fromYear",
        "isActive",
        "syncedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("nbaPersonId") DO UPDATE SET
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        "fullName" = EXCLUDED."fullName",
        "teamId" = EXCLUDED."teamId",
        "teamAbbr" = EXCLUDED."teamAbbr",
        "teamName" = EXCLUDED."teamName",
        "position" = EXCLUDED."position",
        "jerseyNumber" = EXCLUDED."jerseyNumber",
        "fromYear" = EXCLUDED."fromYear",
        "isActive" = EXCLUDED."isActive",
        "syncedAt" = EXCLUDED."syncedAt",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }

  return summary;
}

function playerInsertValues(player: NbaPlayerInput, syncedAt: Date) {
  return Prisma.sql`(
    ${crypto.randomUUID()},
    ${player.nbaPersonId},
    ${player.firstName},
    ${player.lastName},
    ${player.fullName},
    ${player.teamId},
    ${player.teamAbbr},
    ${player.teamName},
    ${player.position},
    ${player.jerseyNumber ?? null},
    ${player.fromYear ?? null},
    ${player.isActive},
    ${syncedAt},
    ${syncedAt},
    ${syncedAt}
  )`;
}

export function resetSyncInFlightForTests() {
  syncInFlight = false;
}
