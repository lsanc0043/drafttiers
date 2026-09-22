import type { Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaSql } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { applyInjuryFlags, getInjuryIndex } from "@/lib/nba/injuries";
import { averageFantasyPoints, parseFantasyScoring, type FantasyScoring } from "@/lib/nba/fantasy";
import type { PlayerListQuery } from "@/lib/nba/schema";
import { usageRate } from "@/lib/nba/usage";
import { FANTASY_AVERAGE_SEASON, isRookieForLeagueYear, leagueStartYear, seasonDateRange } from "@/lib/nba/season";

export function teamSearchTerms(team: string) {
  const normalized = team.trim();
  if (!normalized) {
    return [];
  }

  const terms = new Set<string>([normalized]);
  if (normalized.length > 3 && /s$/i.test(normalized)) {
    terms.add(normalized.slice(0, -1));
  }

  return [...terms];
}

function teamMatchFilter(team: string): Prisma.PlayerWhereInput {
  const clauses: Prisma.PlayerWhereInput[] = [];

  for (const term of teamSearchTerms(team)) {
    clauses.push({ teamAbbr: { contains: term, mode: "insensitive" } });
    clauses.push({ teamName: { contains: term, mode: "insensitive" } });
  }

  return { OR: clauses };
}

export type SeasonAverages = {
  fpts: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  usg: number | null;
};

export type PlayerListSort =
  | "name"
  | "fantasy"
  | "fpts"
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "usg"
  | "pra"
  | "ra"
  | "stocks";

function normalizeSort(sort: PlayerListQuery["sort"]): Exclude<PlayerListSort, "fantasy"> {
  if (sort === "fantasy" || sort == null) {
    return "fpts";
  }
  return sort;
}

function sortDirection(sort: Exclude<PlayerListSort, "fantasy">, dir: PlayerListQuery["sortDir"]) {
  if (dir) {
    return dir;
  }
  return sort === "name" ? "asc" : "desc";
}

function sortMetric(averages: SeasonAverages | undefined, sort: Exclude<PlayerListSort, "fantasy">) {
  if (sort === "name" || !averages) {
    return Number.NEGATIVE_INFINITY;
  }
  if (sort === "fpts") {
    return averages.fpts ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "pts") {
    return averages.pts ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "reb") {
    return averages.reb ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "ast") {
    return averages.ast ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "stl") {
    return averages.stl ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "blk") {
    return averages.blk ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "tov") {
    return averages.tov ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "usg") {
    return averages.usg ?? Number.NEGATIVE_INFINITY;
  }
  if (sort === "pra") {
    if (averages.pts == null || averages.reb == null || averages.ast == null) {
      return Number.NEGATIVE_INFINITY;
    }
    return averages.pts + averages.reb + averages.ast;
  }
  if (sort === "ra") {
    if (averages.reb == null || averages.ast == null) {
      return Number.NEGATIVE_INFINITY;
    }
    return averages.reb + averages.ast;
  }
  if (averages.stl == null || averages.blk == null) {
    return Number.NEGATIVE_INFINITY;
  }
  return averages.stl + averages.blk;
}

export async function listPlayerNamePositions(db: PrismaClient = prisma) {
  return db.player.findMany({
    select: {
      id: true,
      fullName: true,
      position: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function listPlayers(query: PlayerListQuery, db: PrismaClient = prisma) {
  const where: Prisma.PlayerWhereInput = {};
  const filters: Prisma.PlayerWhereInput[] = [];

  if (query.query) {
    filters.push({
      OR: [
        { fullName: { contains: query.query, mode: "insensitive" } },
        { firstName: { contains: query.query, mode: "insensitive" } },
        { lastName: { contains: query.query, mode: "insensitive" } },
      ],
    });
  }

  if (query.active === "true") {
    where.isActive = true;
  } else if (query.active === "false") {
    where.isActive = false;
  }

  if (query.team) {
    filters.push(teamMatchFilter(query.team));
  }

  if (query.rookies === "true") {
    where.fromYear = leagueStartYear();
  }

  if (filters.length === 1) {
    Object.assign(where, filters[0]);
  } else if (filters.length > 1) {
    where.AND = filters;
  }

  const skip = (query.page - 1) * query.pageSize;
  const sort = normalizeSort(query.sort);
  const direction = sortDirection(sort, query.sortDir);
  const scoring = parseFantasyScoring(parseScoringParam(query.scoring));
  const playerSelect = {
    id: true,
    nbaPersonId: true,
    firstName: true,
    lastName: true,
    fullName: true,
    teamId: true,
    teamAbbr: true,
    teamName: true,
    position: true,
    jerseyNumber: true,
    fromYear: true,
    isActive: true,
  } as const;

  if (sort !== "name") {
    const [allPlayers, total] = await Promise.all([
      db.player.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: playerSelect,
      }),
      db.player.count({ where }),
    ]);

    const averages = await seasonAveragesByPlayer(
      db,
      allPlayers.map((player) => player.id),
      scoring,
    );

    const ranked = [...allPlayers].sort((left, right) => {
      const leftAvg = sortMetric(averages.get(left.id), sort);
      const rightAvg = sortMetric(averages.get(right.id), sort);
      if (leftAvg !== rightAvg) {
        return direction === "desc" ? rightAvg - leftAvg : leftAvg - rightAvg;
      }
      return left.lastName.localeCompare(right.lastName) || left.firstName.localeCompare(right.firstName);
    });

    return {
      players: await withInjuryFlags(
        withListFields(ranked.slice(skip, skip + query.pageSize), averages),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  const [players, total] = await Promise.all([
    db.player.findMany({
      where,
      orderBy:
        direction === "desc"
          ? [{ lastName: "desc" }, { firstName: "desc" }]
          : [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: query.pageSize,
      select: playerSelect,
    }),
    db.player.count({ where }),
  ]);

  const averages = await seasonAveragesByPlayer(
    db,
    players.map((player) => player.id),
    scoring,
  );

  return {
    players: await withInjuryFlags(withListFields(players, averages)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

async function withInjuryFlags<T extends { fullName: string; teamAbbr: string | null }>(players: T[]) {
  return applyInjuryFlags(players, await getInjuryIndex());
}

function withListFields(
  players: Array<{
    id: string;
    fromYear: number | null;
    nbaPersonId: number;
    firstName: string;
    lastName: string;
    fullName: string;
    teamId: number | null;
    teamAbbr: string | null;
    teamName: string | null;
    position: string | null;
    jerseyNumber: string | null;
    isActive: boolean;
  }>,
  averages: Map<string, SeasonAverages>,
) {
  return players.map(({ fromYear, ...player }) => {
    const averagesForPlayer = averages.get(player.id);
    return {
      ...player,
      isRookie: isRookieForLeagueYear(fromYear),
      avgFantasyPoints: averagesForPlayer?.fpts ?? null,
      avgPoints: averagesForPlayer?.pts ?? null,
      avgRebounds: averagesForPlayer?.reb ?? null,
      avgAssists: averagesForPlayer?.ast ?? null,
      avgSteals: averagesForPlayer?.stl ?? null,
      avgBlocks: averagesForPlayer?.blk ?? null,
      avgTurnovers: averagesForPlayer?.tov ?? null,
      avgUsageRate: averagesForPlayer?.usg ?? null,
    };
  });
}

function parseScoringParam(raw: string | undefined) {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

type SeasonGameRow = {
  playerId: string;
  teamId: number | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threePointersMade: number;
  minutes: number;
  fieldGoalsAttempted: number;
  freeThrowsAttempted: number;
};

type TeamUsageRow = {
  teamId: number;
  usageMp: number;
  usageFga: number;
  usageFta: number;
  usageTov: number;
};

export async function teamUsageTotals(db: PrismaClient, season = FANTASY_AVERAGE_SEASON) {
  const fromBox = await db.$queryRaw<TeamUsageRow[]>`
    SELECT
      "teamId",
      SUM("minutes") AS "usageMp",
      SUM("fieldGoalsAttempted") AS "usageFga",
      SUM("freeThrowsAttempted") AS "usageFta",
      SUM("turnovers") AS "usageTov"
    FROM "TeamGame"
    WHERE "season" = ${season}
      AND "minutes" IS NOT NULL
    GROUP BY "teamId"
  `;
  if (fromBox.some((row) => Number(row.usageMp) > 0)) {
    return fromBox;
  }

  const { start, end } = seasonDateRange(season);
  return db.$queryRaw<TeamUsageRow[]>`
    SELECT
      p."teamId" AS "teamId",
      SUM(gl."minutes") AS "usageMp",
      SUM(gl."fieldGoalsAttempted") AS "usageFga",
      SUM(gl."freeThrowsAttempted") AS "usageFta",
      SUM(gl."turnovers") AS "usageTov"
    FROM "PlayerGameLog" gl
    INNER JOIN "Player" p ON p.id = gl."playerId"
    INNER JOIN "TeamGame" tg
      ON tg."gameId" = gl."gameId"
     AND tg."teamId" = p."teamId"
    WHERE gl."gameDate" >= ${start}
      AND gl."gameDate" < ${end}
      AND p."teamId" IS NOT NULL
    GROUP BY p."teamId"
  `;
}

export function teamUsageMap(rows: Awaited<ReturnType<typeof teamUsageTotals>>) {
  const totals = new Map<number, { fieldGoalsAttempted: number; freeThrowsAttempted: number; turnovers: number; minutes: number }>();
  for (const row of rows) {
    if (row.teamId == null) {
      continue;
    }
    totals.set(Number(row.teamId), {
      minutes: Number(row.usageMp) || 0,
      fieldGoalsAttempted: Number(row.usageFga) || 0,
      freeThrowsAttempted: Number(row.usageFta) || 0,
      turnovers: Number(row.usageTov) || 0,
    });
  }
  return totals;
}

async function seasonAveragesByPlayer(db: PrismaClient, playerIds: string[], scoring: FantasyScoring) {
  const averages = new Map<string, SeasonAverages>();
  if (playerIds.length === 0) {
    return averages;
  }

  const { start, end } = seasonDateRange(FANTASY_AVERAGE_SEASON);
  const [rows, teamRows] = await Promise.all([
    db.$queryRaw<SeasonGameRow[]>`
      SELECT
        gl."playerId",
        p."teamId",
        gl."points",
        gl."rebounds",
        gl."assists",
        gl."steals",
        gl."blocks",
        gl."turnovers",
        gl."threePointersMade",
        gl."minutes",
        gl."fieldGoalsAttempted",
        gl."freeThrowsAttempted"
      FROM "PlayerGameLog" gl
      INNER JOIN "Player" p ON p.id = gl."playerId"
      WHERE gl."playerId" IN (${PrismaSql.join(playerIds.map((id) => PrismaSql.sql`${id}`))})
        AND gl."gameDate" >= ${start}
        AND gl."gameDate" < ${end}
    `,
    teamUsageTotals(db),
  ]);
  const teamTotals = teamUsageMap(teamRows);

  const gamesByPlayer = new Map<string, SeasonGameRow[]>();
  for (const row of rows) {
    const list = gamesByPlayer.get(row.playerId) ?? [];
    list.push(row);
    gamesByPlayer.set(row.playerId, list);
  }

  for (const playerId of playerIds) {
    const games = gamesByPlayer.get(playerId) ?? [];
    const empty: SeasonAverages = {
      fpts: null,
      pts: null,
      reb: null,
      ast: null,
      stl: null,
      blk: null,
      tov: null,
      usg: null,
    };
    if (games.length === 0) {
      averages.set(playerId, empty);
      continue;
    }
    const played = games.filter((game) => Number(game.minutes) > 0);
    const count = played.length || games.length;
    const source = played.length > 0 ? played : games;
    const sum = (key: keyof Omit<SeasonGameRow, "playerId" | "teamId" | "threePointersMade">) =>
      source.reduce((total, game) => total + Number(game[key] ?? 0), 0) / count;
    const teamId = source[0]?.teamId;
    const team = teamId != null ? teamTotals.get(Number(teamId)) : undefined;
    const playerBox = {
      fieldGoalsAttempted: source.reduce((total, game) => total + Number(game.fieldGoalsAttempted ?? 0), 0),
      freeThrowsAttempted: source.reduce((total, game) => total + Number(game.freeThrowsAttempted ?? 0), 0),
      turnovers: source.reduce((total, game) => total + Number(game.turnovers ?? 0), 0),
      minutes: source.reduce((total, game) => total + Number(game.minutes ?? 0), 0),
    };
    averages.set(playerId, {
      fpts: averageFantasyPoints(source, scoring),
      pts: sum("points"),
      reb: sum("rebounds"),
      ast: sum("assists"),
      stl: sum("steals"),
      blk: sum("blocks"),
      tov: sum("turnovers"),
      usg: team ? usageRate(playerBox, team, count) : null,
    });
  }

  return averages;
}
