import { type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseFantasyScoring } from "@/lib/nba/fantasy";
import type {
  AssignBoardPlayerInput,
  BulkBoardPlayersInput,
  CreateBoardInput,
  CreateBucketInput,
  DraftSettingsInput,
  UpdateBoardInput,
  UpdateBucketInput,
} from "@/lib/validation";
import type { BoardBucket, BoardBucketPlayer, BoardDetail, BoardSummary, DraftSettings } from "@/types";

type BoardRecord = {
  id: string;
  name: string;
  visibility: "PRIVATE" | "SHARED";
  createdAt: Date;
  updatedAt: Date;
  teamCount?: number | null;
  draftPosition?: number | null;
  roundCount?: number | null;
  draftType?: "SNAKE" | "LINEAR" | "CUSTOM" | null;
  roundTimerSeconds?: number | null;
  fantasyScoring?: unknown;
  sleeperDraftId?: string | null;
  buckets: Array<{
    id: string;
    name: string;
    color?: string | null;
    sortOrder: number;
  }>;
};

type AssignmentRecord = {
  id: string;
  bucketId: string;
  playerId: string;
  sortOrder: number;
  player: {
    id: string;
    nbaPersonId: number;
    fullName: string;
    teamAbbr: string | null;
    teamName: string | null;
    position: string | null;
    jerseyNumber: string | null;
    isActive: boolean;
  };
};

function serializeAssignment(assignment: AssignmentRecord): BoardBucketPlayer {
  return {
    assignmentId: assignment.id,
    playerId: assignment.player.id,
    nbaPersonId: assignment.player.nbaPersonId,
    fullName: assignment.player.fullName,
    teamAbbr: assignment.player.teamAbbr,
    teamName: assignment.player.teamName,
    position: assignment.player.position,
    jerseyNumber: assignment.player.jerseyNumber,
    isActive: assignment.player.isActive,
    sortOrder: assignment.sortOrder,
  };
}

function serializeBucket(
  bucket: BoardRecord["buckets"][number],
  players: BoardBucketPlayer[] = [],
): BoardBucket {
  return {
    id: bucket.id,
    name: bucket.name,
    color: bucket.color ?? "#71717a",
    sortOrder: bucket.sortOrder,
    players,
  };
}

function serializeDraftSettings(board: Omit<BoardRecord, "buckets">): DraftSettings | null {
  if (
    board.teamCount == null ||
    board.draftPosition == null ||
    board.roundCount == null ||
    board.draftType == null ||
    board.roundTimerSeconds == null ||
    board.fantasyScoring == null
  ) {
    return null;
  }

  return {
    teamCount: board.teamCount,
    draftPosition: board.draftPosition,
    roundCount: board.roundCount,
    draftType: board.draftType,
    roundTimerSeconds: board.roundTimerSeconds,
    fantasyScoring: parseFantasyScoring(board.fantasyScoring),
    ...(board.sleeperDraftId ? { sleeperDraftId: board.sleeperDraftId } : {}),
  };
}

async function saveDraftSettings(
  boardId: string,
  settings: DraftSettingsInput | null,
  db: PrismaClient,
) {
  const now = new Date();
  if (!settings) {
    await db.$executeRaw`
      UPDATE "Board"
      SET "teamCount" = NULL,
          "draftPosition" = NULL,
          "roundCount" = NULL,
          "draftType" = NULL,
          "roundTimerSeconds" = NULL,
          "fantasyScoring" = NULL,
          "updatedAt" = ${now}
      WHERE id = ${boardId}
    `;
    return;
  }

  const scoringJson = JSON.stringify(settings.fantasyScoring);
  await db.$executeRaw`
    UPDATE "Board"
    SET "teamCount" = ${settings.teamCount},
        "draftPosition" = ${settings.draftPosition},
        "roundCount" = ${settings.roundCount},
        "draftType" = CAST(${settings.draftType} AS "DraftType"),
        "roundTimerSeconds" = ${settings.roundTimerSeconds},
        "fantasyScoring" = CAST(${scoringJson} AS JSONB),
        "updatedAt" = ${now}
    WHERE id = ${boardId}
  `;
}

async function saveLinkedSleeperDraft(
  boardId: string,
  sleeperDraftId: string | null | undefined,
  db: PrismaClient,
) {
  if (!sleeperDraftId) {
    return;
  }
  try {
    await db.sleeperDraft.upsert({
      where: { sleeperDraftId },
      create: { boardId, sleeperDraftId },
      update: { boardId },
    });
  } catch {
    // Linking is optional; the client also keeps the draft ID locally.
  }
}

async function loadLinkedSleeperDraftId(boardId: string, db: PrismaClient) {
  try {
    const linked = await db.sleeperDraft.findFirst({
      where: { boardId },
      select: { sleeperDraftId: true },
      orderBy: { updatedAt: "desc" },
    });
    return linked?.sleeperDraftId ?? null;
  } catch {
    return null;
  }
}

async function loadBoardRow(boardId: string, db: PrismaClient) {
  const rows = await db.$queryRaw<Array<Omit<BoardRecord, "buckets">>>`
    SELECT id, name, visibility, "createdAt", "updatedAt",
           "teamCount", "draftPosition", "roundCount", "draftType",
           "roundTimerSeconds", "fantasyScoring"
    FROM "Board"
    WHERE id = ${boardId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function draftSettingsOnBoard(settings: DraftSettingsInput | null | undefined) {
  if (!settings) {
    return {};
  }
  return {
    teamCount: settings.teamCount,
    draftPosition: settings.draftPosition,
    roundCount: settings.roundCount,
    draftType: settings.draftType,
    roundTimerSeconds: settings.roundTimerSeconds,
    fantasyScoring: settings.fantasyScoring,
  };
}

function serializeBoard(
  board: BoardRecord,
  assignments: AssignmentRecord[] = [],
): BoardDetail {
  const playersByBucket = new Map<string, BoardBucketPlayer[]>();
  for (const assignment of assignments) {
    const list = playersByBucket.get(assignment.bucketId) ?? [];
    list.push(serializeAssignment(assignment));
    playersByBucket.set(assignment.bucketId, list);
  }

  return {
    id: board.id,
    name: board.name,
    visibility: board.visibility,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    sleeperDraftId: board.sleeperDraftId ?? null,
    draftSettings: serializeDraftSettings(board),
    buckets: [...board.buckets]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((bucket) => serializeBucket(bucket, playersByBucket.get(bucket.id) ?? [])),
  };
}

async function loadBuckets(boardId: string, db: PrismaClient) {
  return db.$queryRaw<BoardRecord["buckets"]>`
    SELECT id, name, color, "sortOrder"
    FROM "Bucket"
    WHERE "boardId" = ${boardId}
    ORDER BY "sortOrder" ASC
  `;
}

async function loadAssignments(boardId: string, db: PrismaClient) {
  return db.boardPlayer.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    include: {
      player: {
        select: {
          id: true,
          nbaPersonId: true,
          fullName: true,
          teamAbbr: true,
          teamName: true,
          position: true,
          jerseyNumber: true,
          isActive: true,
        },
      },
    },
  });
}

export async function listBoards(db: PrismaClient = prisma): Promise<BoardSummary[]> {
  const boards = await db.$queryRaw<
    Array<Omit<BoardRecord, "buckets"> & { bucketCount: number }>
  >`
    SELECT b.id, b.name, b.visibility, b."createdAt", b."updatedAt",
           b."teamCount", b."draftPosition", b."roundCount", b."draftType",
           b."roundTimerSeconds", b."fantasyScoring",
           (SELECT COUNT(*)::int FROM "Bucket" k WHERE k."boardId" = b.id) AS "bucketCount"
    FROM "Board" b
    ORDER BY b."updatedAt" DESC
  `;

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    visibility: board.visibility,
    updatedAt: board.updatedAt.toISOString(),
    bucketCount: Number(board.bucketCount),
    hasDraftSettings: serializeDraftSettings(board) != null,
  }));
}

export async function getBoard(id: string, db: PrismaClient = prisma) {
  const board = await loadBoardRow(id, db);
  if (!board) {
    return null;
  }
  const [buckets, assignments, sleeperDraftId] = await Promise.all([
    loadBuckets(board.id, db),
    loadAssignments(board.id, db),
    loadLinkedSleeperDraftId(board.id, db),
  ]);
  return serializeBoard({ ...board, buckets, sleeperDraftId }, assignments);
}

export async function createBoard(input: CreateBoardInput, db: PrismaClient = prisma) {
  const board = await db.board.create({
    data: {
      name: input.name,
      visibility: input.visibility,
    },
  });

  if (input.draftSettings) {
    await saveDraftSettings(board.id, input.draftSettings, db);
    await saveLinkedSleeperDraft(board.id, input.draftSettings.sleeperDraftId, db);
  }

  return serializeBoard({
    ...board,
    ...draftSettingsOnBoard(input.draftSettings),
    sleeperDraftId: input.draftSettings?.sleeperDraftId ?? null,
    buckets: [],
  });
}

export async function updateBoard(
  id: string,
  input: UpdateBoardInput,
  db: PrismaClient = prisma,
) {
  const existing = await db.board.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  if (input.name != null || input.visibility != null) {
    await db.board.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.visibility != null ? { visibility: input.visibility } : {}),
      },
    });
  }
  if (input.draftSettings !== undefined) {
    await saveDraftSettings(id, input.draftSettings, db);
    await saveLinkedSleeperDraft(id, input.draftSettings?.sleeperDraftId, db);
  }
  if (input.sleeperDraftId !== undefined) {
    await saveLinkedSleeperDraft(id, input.sleeperDraftId, db);
  }

  return getBoard(id, db);
}

export async function deleteBoard(id: string, db: PrismaClient = prisma) {
  const existing = await db.board.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return false;
  }

  await db.board.delete({ where: { id } });
  return true;
}

export async function addBucket(
  boardId: string,
  input: CreateBucketInput,
  db: PrismaClient = prisma,
) {
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) {
    return null;
  }

  const orderRows = await db.$queryRaw<Array<{ maxOrder: number | null }>>`
    SELECT MAX("sortOrder") AS "maxOrder" FROM "Bucket" WHERE "boardId" = ${boardId}
  `;
  const nextOrder = input.sortOrder ?? Number(orderRows[0]?.maxOrder ?? -1) + 1;
  const now = new Date();
  const id = crypto.randomUUID();

  await db.$executeRaw`
    INSERT INTO "Bucket" ("id", "boardId", "name", "color", "sortOrder", "createdAt", "updatedAt")
    VALUES (${id}, ${boardId}, ${input.name}, ${input.color}, ${nextOrder}, ${now}, ${now})
  `;
  await db.board.update({ where: { id: boardId }, data: { updatedAt: now } });

  return serializeBucket({
    id,
    name: input.name,
    color: input.color,
    sortOrder: nextOrder,
  });
}

export async function updateBucket(
  boardId: string,
  bucketId: string,
  input: UpdateBucketInput,
  db: PrismaClient = prisma,
) {
  const [existing] = await db.$queryRaw<BoardRecord["buckets"]>`
    SELECT id, name, color, "sortOrder"
    FROM "Bucket"
    WHERE id = ${bucketId} AND "boardId" = ${boardId}
    LIMIT 1
  `;
  if (!existing) {
    return null;
  }

  const name = input.name ?? existing.name;
  const color = input.color ?? existing.color ?? "#71717a";
  const sortOrder = input.sortOrder ?? existing.sortOrder;
  const now = new Date();

  await db.$executeRaw`
    UPDATE "Bucket"
    SET name = ${name}, color = ${color}, "sortOrder" = ${sortOrder}, "updatedAt" = ${now}
    WHERE id = ${bucketId} AND "boardId" = ${boardId}
  `;
  await db.board.update({ where: { id: boardId }, data: { updatedAt: now } });

  return serializeBucket({ id: bucketId, name, color, sortOrder });
}

export async function deleteBucket(
  boardId: string,
  bucketId: string,
  db: PrismaClient = prisma,
) {
  const deleted = await db.$executeRaw`
    DELETE FROM "Bucket" WHERE id = ${bucketId} AND "boardId" = ${boardId}
  `;
  if (!deleted) {
    return false;
  }
  await db.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
  return true;
}

export async function assignPlayerToBucket(
  boardId: string,
  input: AssignBoardPlayerInput,
  db: PrismaClient = prisma,
) {
  const [board, bucket, player] = await Promise.all([
    db.board.findUnique({ where: { id: boardId } }),
    db.bucket.findFirst({ where: { id: input.bucketId, boardId } }),
    db.player.findUnique({
      where: { id: input.playerId },
      select: {
        id: true,
        nbaPersonId: true,
        fullName: true,
        teamAbbr: true,
        teamName: true,
        position: true,
        jerseyNumber: true,
        isActive: true,
      },
    }),
  ]);

  if (!board) {
    return { ok: false as const, reason: "board" };
  }
  if (!bucket) {
    return { ok: false as const, reason: "bucket" };
  }
  if (!player) {
    return { ok: false as const, reason: "player" };
  }

  const current = await db.boardPlayer.findMany({
    where: { boardId, bucketId: input.bucketId },
    orderBy: { sortOrder: "asc" },
    select: { playerId: true, sortOrder: true },
  });
  const previousOrder = new Map(current.map((row) => [row.playerId, row.sortOrder]));
  const ordered = current.map((row) => row.playerId).filter((id) => id !== input.playerId);
  if (input.beforePlayerId) {
    const insertAt = ordered.indexOf(input.beforePlayerId);
    ordered.splice(insertAt === -1 ? ordered.length : insertAt, 0, input.playerId);
  } else {
    ordered.push(input.playerId);
  }

  const sortOrder = Math.max(0, ordered.indexOf(input.playerId));
  const assignment = await db.boardPlayer.upsert({
    where: {
      boardId_playerId: {
        boardId,
        playerId: input.playerId,
      },
    },
    create: {
      boardId,
      bucketId: input.bucketId,
      playerId: input.playerId,
      sortOrder,
    },
    update: {
      bucketId: input.bucketId,
      sortOrder,
    },
  });

  await Promise.all(
    ordered.flatMap((playerId, nextOrder) => {
      if (playerId === input.playerId || previousOrder.get(playerId) === nextOrder) {
        return [];
      }
      return [
        db.boardPlayer.update({
          where: { boardId_playerId: { boardId, playerId } },
          data: { bucketId: input.bucketId, sortOrder: nextOrder },
        }),
      ];
    }),
  );
  await db.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });

  return {
    ok: true as const,
    player: serializeAssignment({
      id: assignment.id,
      bucketId: input.bucketId,
      playerId: assignment.playerId,
      sortOrder,
      player,
    }),
    bucketId: input.bucketId,
  };
}

export async function unassignPlayerFromBoard(
  boardId: string,
  playerId: string,
  db: PrismaClient = prisma,
) {
  const assignment = await db.boardPlayer.findUnique({
    where: {
      boardId_playerId: {
        boardId,
        playerId,
      },
    },
    select: { id: true, bucketId: true },
  });
  if (!assignment) {
    return false;
  }

  await db.boardPlayer.delete({ where: { id: assignment.id } });
  const remaining = await db.boardPlayer.findMany({
    where: { boardId, bucketId: assignment.bucketId },
    orderBy: { sortOrder: "asc" },
    select: { playerId: true },
  });
  await Promise.all(
    remaining.map((row, sortOrder) =>
      db.boardPlayer.update({
        where: { boardId_playerId: { boardId, playerId: row.playerId } },
        data: { sortOrder },
      }),
    ),
  );
  await db.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
  return true;
}

export async function clearBoardPlayers(boardId: string, db: PrismaClient = prisma) {
  const board = await db.board.findUnique({ where: { id: boardId }, select: { id: true } });
  if (!board) {
    return false;
  }

  await db.boardPlayer.deleteMany({ where: { boardId } });
  await db.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
  return true;
}

export async function bulkUpdateBoardPlayers(
  boardId: string,
  input: BulkBoardPlayersInput,
  db: PrismaClient = prisma,
) {
  const board = await db.board.findUnique({ where: { id: boardId }, select: { id: true } });
  if (!board) {
    return { ok: false as const, reason: "board" };
  }

  const playerIds = [...new Set(input.playerIds)];

  if (input.action === "unassign") {
    await db.boardPlayer.deleteMany({
      where: { boardId, playerId: { in: playerIds } },
    });
    const remaining = await db.boardPlayer.findMany({
      where: { boardId },
      orderBy: [{ bucketId: "asc" }, { sortOrder: "asc" }],
      select: { bucketId: true, playerId: true },
    });
    const nextOrder = new Map<string, number>();
    await Promise.all(
      remaining.map((row) => {
        const sortOrder = nextOrder.get(row.bucketId) ?? 0;
        nextOrder.set(row.bucketId, sortOrder + 1);
        return db.boardPlayer.update({
          where: { boardId_playerId: { boardId, playerId: row.playerId } },
          data: { sortOrder },
        });
      }),
    );
    await db.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
    return { ok: true as const };
  }

  const bucket = await db.bucket.findFirst({
    where: { id: input.bucketId, boardId },
    select: { id: true },
  });
  if (!bucket || !input.bucketId) {
    return { ok: false as const, reason: "bucket" };
  }

  const assignments = await db.boardPlayer.findMany({
    where: { boardId, playerId: { in: playerIds } },
    select: { playerId: true },
  });
  const assigned = new Set(assignments.map((row) => row.playerId));
  const moving = playerIds.filter((playerId) => assigned.has(playerId));
  if (moving.length === 0) {
    return { ok: true as const };
  }

  const all = await db.boardPlayer.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    select: { bucketId: true, playerId: true },
  });
  const byBucket = new Map<string, string[]>();
  for (const row of all) {
    if (assigned.has(row.playerId)) {
      continue;
    }
    const list = byBucket.get(row.bucketId) ?? [];
    list.push(row.playerId);
    byBucket.set(row.bucketId, list);
  }
  const target = byBucket.get(input.bucketId) ?? [];
  target.push(...moving);
  byBucket.set(input.bucketId, target);

  await Promise.all(
    [...byBucket.entries()].flatMap(([bucketId, orderedIds]) =>
      orderedIds.map((playerId, sortOrder) =>
        db.boardPlayer.update({
          where: { boardId_playerId: { boardId, playerId } },
          data: { bucketId, sortOrder },
        }),
      ),
    ),
  );
  await db.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
  return { ok: true as const };
}
