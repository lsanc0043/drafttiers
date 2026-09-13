import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseNbaStatsBundle, runNbaStatsPythonSync } from "@/lib/nba/python";
import { mapStatsToKnownPlayers, persistGameLogs, persistSeasonStats, persistTeamGames } from "@/lib/nba/stats-upsert";

const SYNC_ID = "nba-stats";
const STALE_RUNNING_MS = 5 * 60 * 1000;

let statsSyncInFlight = false;

export class StatsSyncInProgressError extends Error {
  constructor() {
    super("An NBA stats sync is already running");
    this.name = "StatsSyncInProgressError";
  }
}

export type StatsSyncResult = {
  success: true;
  playersProcessed: number;
  seasonStatsProcessed: number;
  gameLogsProcessed: number;
  skipped: number;
  failed: number;
  completedAt: string;
  errors: string[];
};

export type StatsSyncStatusPayload = {
  status: "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  playersProcessed: number | null;
  seasonStatsProcessed: number | null;
  gameLogsProcessed: number | null;
  lastError: string | null;
};

type StatsSyncDeps = {
  prisma: PrismaClient;
  fetchBundle: (playerId?: number) => Promise<unknown>;
  now: () => Date;
};

const defaultDeps: StatsSyncDeps = {
  prisma,
  fetchBundle: (playerId) => runNbaStatsPythonSync({ playerId }),
  now: () => new Date(),
};

export async function getNbaStatsSyncStatus(
  db: PrismaClient = prisma,
): Promise<StatsSyncStatusPayload> {
  const state = await db.nbaSyncState.findUnique({ where: { id: SYNC_ID } });
  return {
    status: state?.status ?? "IDLE",
    lastStartedAt: state?.lastStartedAt?.toISOString() ?? null,
    lastFinishedAt: state?.lastFinishedAt?.toISOString() ?? null,
    lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
    playersProcessed: state?.fetchedCount ?? null,
    seasonStatsProcessed: state?.insertedCount ?? null,
    gameLogsProcessed: state?.updatedCount ?? null,
    lastError: state?.lastError ?? null,
  };
}

export async function syncNbaStats(
  options: { playerId?: number } = {},
  deps: Partial<StatsSyncDeps> = {},
): Promise<StatsSyncResult> {
  const { prisma: db, fetchBundle, now } = { ...defaultDeps, ...deps };

  if (statsSyncInFlight) {
    throw new StatsSyncInProgressError();
  }

  statsSyncInFlight = true;
  const startedAt = now();

  try {
    const existingState = await db.nbaSyncState.findUnique({ where: { id: SYNC_ID } });
    if (existingState?.status === "RUNNING" && existingState.lastStartedAt) {
      const age = now().getTime() - existingState.lastStartedAt.getTime();
      if (age < STALE_RUNNING_MS) {
        throw new StatsSyncInProgressError();
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

    const bundle = parseNbaStatsBundle(await fetchBundle(options.playerId));
    const players = await db.player.findMany({ select: { id: true, nbaPersonId: true } });
    const playersByNbaId = new Map(players.map((player) => [player.nbaPersonId, player.id]));

    const seasonMapped = mapStatsToKnownPlayers(bundle.seasonStats, playersByNbaId);
    const gameMapped = mapStatsToKnownPlayers(bundle.gameLogs, playersByNbaId);
    const syncedAt = now();

    await persistSeasonStats(db, seasonMapped.mapped, syncedAt);
    await persistGameLogs(db, gameMapped.mapped, syncedAt);
    await persistTeamGames(db, bundle.teamGames, syncedAt);

    const playersProcessed = new Set([
      ...seasonMapped.mapped.map((row) => row.playerId),
      ...gameMapped.mapped.map((row) => row.playerId),
    ]).size;
    const failed = bundle.parseFailed + bundle.errors.length;
    const skipped = seasonMapped.skipped + gameMapped.skipped;
    const completedAt = now();

    await db.nbaSyncState.update({
      where: { id: SYNC_ID },
      data: {
        status: "SUCCESS",
        lastFinishedAt: completedAt,
        lastSuccessAt: completedAt,
        fetchedCount: playersProcessed,
        insertedCount: seasonMapped.mapped.length,
        updatedCount: gameMapped.mapped.length,
        failedCount: failed,
        lastError: bundle.errors.length ? bundle.errors.slice(0, 8).join("; ").slice(0, 2000) : null,
      },
    });

    return {
      success: true,
      playersProcessed,
      seasonStatsProcessed: seasonMapped.mapped.length,
      gameLogsProcessed: gameMapped.mapped.length,
      skipped,
      failed,
      completedAt: completedAt.toISOString(),
      errors: bundle.errors,
    };
  } catch (error) {
    if (!(error instanceof StatsSyncInProgressError)) {
      const message = error instanceof Error ? error.message : "Unknown NBA stats sync error";
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
    statsSyncInFlight = false;
  }
}

export function resetStatsSyncInFlightForTests() {
  statsSyncInFlight = false;
}
