import type { Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaSql } from "@prisma/client";
import { chunk } from "@/lib/nba/upsert";
import type { NbaGameLogInput, NbaSeasonStatInput } from "@/lib/nba/schema";

const UPSERT_CHUNK_SIZE = 300;

export function mapStatsToKnownPlayers<T extends { nbaPersonId: number }>(
  rows: T[],
  playersByNbaId: Map<number, string>,
) {
  const mapped: Array<T & { playerId: string }> = [];
  let skipped = 0;

  for (const row of rows) {
    const playerId = playersByNbaId.get(row.nbaPersonId);
    if (!playerId) {
      skipped += 1;
      continue;
    }
    mapped.push({ ...row, playerId });
  }

  return { mapped, skipped };
}

export async function persistSeasonStats(
  db: PrismaClient,
  stats: Array<NbaSeasonStatInput & { playerId: string }>,
  now: Date,
) {
  if (stats.length === 0) {
    return;
  }
  for (const group of chunk(stats, UPSERT_CHUNK_SIZE)) {
    const values = group.map((row) => seasonInsertValues(row, now));
    await db.$executeRaw`
      INSERT INTO "PlayerSeasonStats" (
        "id", "playerId", "season", "gamesPlayed", "minutes", "points", "rebounds",
        "assists", "steals", "blocks", "turnovers", "fieldGoalsMade", "fieldGoalsAttempted",
        "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted",
        "createdAt", "updatedAt"
      )
      VALUES ${PrismaSql.join(values)}
      ON CONFLICT ("playerId", "season") DO UPDATE SET
        "gamesPlayed" = EXCLUDED."gamesPlayed",
        "minutes" = EXCLUDED."minutes",
        "points" = EXCLUDED."points",
        "rebounds" = EXCLUDED."rebounds",
        "assists" = EXCLUDED."assists",
        "steals" = EXCLUDED."steals",
        "blocks" = EXCLUDED."blocks",
        "turnovers" = EXCLUDED."turnovers",
        "fieldGoalsMade" = EXCLUDED."fieldGoalsMade",
        "fieldGoalsAttempted" = EXCLUDED."fieldGoalsAttempted",
        "threePointersMade" = EXCLUDED."threePointersMade",
        "threePointersAttempted" = EXCLUDED."threePointersAttempted",
        "freeThrowsMade" = EXCLUDED."freeThrowsMade",
        "freeThrowsAttempted" = EXCLUDED."freeThrowsAttempted",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

export async function persistGameLogs(
  db: PrismaClient,
  logs: Array<NbaGameLogInput & { playerId: string }>,
  now: Date,
) {
  if (logs.length === 0) {
    return;
  }
  for (const group of chunk(logs, UPSERT_CHUNK_SIZE)) {
    const values = group.map((row) => gameLogInsertValues(row, now));
    await db.$executeRaw`
      INSERT INTO "PlayerGameLog" (
        "id", "playerId", "gameId", "gameDate", "minutes", "points", "rebounds",
        "assists", "steals", "blocks", "turnovers", "fieldGoalsMade", "fieldGoalsAttempted",
        "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted",
        "createdAt", "updatedAt"
      )
      VALUES ${PrismaSql.join(values)}
      ON CONFLICT ("playerId", "gameId") DO UPDATE SET
        "gameDate" = EXCLUDED."gameDate",
        "minutes" = EXCLUDED."minutes",
        "points" = EXCLUDED."points",
        "rebounds" = EXCLUDED."rebounds",
        "assists" = EXCLUDED."assists",
        "steals" = EXCLUDED."steals",
        "blocks" = EXCLUDED."blocks",
        "turnovers" = EXCLUDED."turnovers",
        "fieldGoalsMade" = EXCLUDED."fieldGoalsMade",
        "fieldGoalsAttempted" = EXCLUDED."fieldGoalsAttempted",
        "threePointersMade" = EXCLUDED."threePointersMade",
        "threePointersAttempted" = EXCLUDED."threePointersAttempted",
        "freeThrowsMade" = EXCLUDED."freeThrowsMade",
        "freeThrowsAttempted" = EXCLUDED."freeThrowsAttempted",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

function seasonInsertValues(row: NbaSeasonStatInput & { playerId: string }, now: Date) {
  return PrismaSql.sql`(
    ${crypto.randomUUID()},
    ${row.playerId},
    ${row.season},
    ${row.gamesPlayed},
    ${row.minutes},
    ${row.points},
    ${row.rebounds},
    ${row.assists},
    ${row.steals},
    ${row.blocks},
    ${row.turnovers},
    ${row.fieldGoalsMade},
    ${row.fieldGoalsAttempted},
    ${row.threePointersMade},
    ${row.threePointersAttempted},
    ${row.freeThrowsMade},
    ${row.freeThrowsAttempted},
    ${now},
    ${now}
  )`;
}

function gameLogInsertValues(row: NbaGameLogInput & { playerId: string }, now: Date) {
  return PrismaSql.sql`(
    ${crypto.randomUUID()},
    ${row.playerId},
    ${row.gameId},
    ${new Date(`${row.gameDate}T00:00:00.000Z`)},
    ${row.minutes},
    ${row.points},
    ${row.rebounds},
    ${row.assists},
    ${row.steals},
    ${row.blocks},
    ${row.turnovers},
    ${row.fieldGoalsMade},
    ${row.fieldGoalsAttempted},
    ${row.threePointersMade},
    ${row.threePointersAttempted},
    ${row.freeThrowsMade},
    ${row.freeThrowsAttempted},
    ${now},
    ${now}
  )`;
}

export function recentGameLogsQuery(playerId: string, take = 10): Prisma.PlayerGameLogFindManyArgs {
  return {
    where: { playerId },
    orderBy: { gameDate: "desc" },
    take,
  };
}
