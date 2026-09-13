import type { Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaSql } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { applyInjuryFlags, getInjuryIndex } from "@/lib/nba/injuries";
import { averageFantasyPoints, parseFantasyScoring, type FantasyScoring } from "@/lib/nba/fantasy";
import type { PlayerListQuery } from "@/lib/nba/schema";
import { FANTASY_AVERAGE_SEASON, isRookieForLeagueYear, seasonDateRange } from "@/lib/nba/season";

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

  if (filters.length === 1) {
    Object.assign(where, filters[0]);
  } else if (filters.length > 1) {
    where.AND = filters;
  }

  const skip = (query.page - 1) * query.pageSize;
  const sort = query.sort ?? "name";
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

  if (sort === "fantasy") {
    const [allPlayers, total] = await Promise.all([
      db.player.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: playerSelect,
      }),
      db.player.count({ where }),
    ]);

    const averages = await averageFantasyByPlayer(
      db,
      allPlayers.map((player) => player.id),
      parseFantasyScoring(parseScoringParam(query.scoring)),
    );

    const ranked = [...allPlayers].sort((left, right) => {
      const leftAvg = averages.get(left.id) ?? -Infinity;
      const rightAvg = averages.get(right.id) ?? -Infinity;
      if (rightAvg !== leftAvg) {
        return rightAvg - leftAvg;
      }
      return left.lastName.localeCompare(right.lastName) || left.firstName.localeCompare(right.firstName);
    });

    return {
      players: await withInjuryFlags(withListFields(ranked.slice(skip, skip + query.pageSize), averages)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  const [players, total] = await Promise.all([
    db.player.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: query.pageSize,
      select: playerSelect,
    }),
    db.player.count({ where }),
  ]);

  const averages = await averageFantasyByPlayer(
    db,
    players.map((player) => player.id),
    parseFantasyScoring(parseScoringParam(query.scoring)),
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
  averages: Map<string, number | null>,
) {
  return players.map(({ fromYear, ...player }) => ({
    ...player,
    isRookie: isRookieForLeagueYear(fromYear),
    avgFantasyPoints: averages.get(player.id) ?? null,
  }));
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
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threePointersMade: number;
};

async function averageFantasyByPlayer(db: PrismaClient, playerIds: string[], scoring: FantasyScoring) {
  const averages = new Map<string, number | null>();
  if (playerIds.length === 0) {
    return averages;
  }

  const { start, end } = seasonDateRange(FANTASY_AVERAGE_SEASON);
  const rows = await db.$queryRaw<SeasonGameRow[]>`
    SELECT
      "playerId",
      "points",
      "rebounds",
      "assists",
      "steals",
      "blocks",
      "turnovers",
      "threePointersMade"
    FROM "PlayerGameLog"
    WHERE "playerId" IN (${PrismaSql.join(playerIds.map((id) => PrismaSql.sql`${id}`))})
      AND "gameDate" >= ${start}
      AND "gameDate" < ${end}
  `;

  const gamesByPlayer = new Map<string, SeasonGameRow[]>();
  for (const row of rows) {
    const list = gamesByPlayer.get(row.playerId) ?? [];
    list.push(row);
    gamesByPlayer.set(row.playerId, list);
  }

  for (const playerId of playerIds) {
    averages.set(playerId, averageFantasyPoints(gamesByPlayer.get(playerId) ?? [], scoring));
  }

  return averages;
}
