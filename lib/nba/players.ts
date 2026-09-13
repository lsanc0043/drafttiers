import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlayerListQuery } from "@/lib/nba/schema";
import { isRookieForLeagueYear } from "@/lib/nba/season";

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

  const [players, total] = await Promise.all([
    db.player.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: query.pageSize,
      select: {
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
      },
    }),
    db.player.count({ where }),
  ]);

  return {
    players: players.map(({ fromYear, ...player }) => ({
      ...player,
      isRookie: isRookieForLeagueYear(fromYear),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
