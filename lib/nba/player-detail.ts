import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { scoreFantasyGame } from "@/lib/nba/fantasy";
import { getInjuryIndex, getPlayerInjury } from "@/lib/nba/injuries";
import { FANTASY_AVERAGE_SEASON, isRookieForLeagueYear, seasonDateRange } from "@/lib/nba/season";

type SeasonStatRow = {
  season: string;
  gamesPlayed: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
};

type GameLogRow = {
  gameId: string;
  gameDate: Date;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
};

export async function getPlayerDetail(id: string, db: PrismaClient = prisma) {
  const numericId = Number(id);
  const player = await db.player.findFirst({
    where: Number.isInteger(numericId) && numericId > 0
      ? { OR: [{ id }, { nbaPersonId: numericId }] }
      : { id },
  });

  if (!player) {
    return null;
  }

  const { start: seasonStart, end: seasonEnd } = seasonDateRange(FANTASY_AVERAGE_SEASON);

  const [seasonStats, recentGames, seasonGames, injuries] = await Promise.all([
    db.$queryRaw<SeasonStatRow[]>`
      SELECT
        "season",
        "gamesPlayed",
        "minutes",
        "points",
        "rebounds",
        "assists",
        "steals",
        "blocks",
        "turnovers",
        "fieldGoalsMade",
        "fieldGoalsAttempted",
        "threePointersMade",
        "threePointersAttempted",
        "freeThrowsMade",
        "freeThrowsAttempted"
      FROM "PlayerSeasonStats"
      WHERE "playerId" = ${player.id}
        AND "season" = ${FANTASY_AVERAGE_SEASON}
      LIMIT 1
    `,
    db.$queryRaw<GameLogRow[]>`
      SELECT
        "gameId",
        "gameDate",
        "minutes",
        "points",
        "rebounds",
        "assists",
        "steals",
        "blocks",
        "turnovers",
        "fieldGoalsMade",
        "fieldGoalsAttempted",
        "threePointersMade",
        "threePointersAttempted",
        "freeThrowsMade",
        "freeThrowsAttempted"
      FROM "PlayerGameLog"
      WHERE "playerId" = ${player.id}
      ORDER BY "gameDate" DESC
      LIMIT 10
    `,
    db.$queryRaw<GameLogRow[]>`
      SELECT
        "gameId",
        "gameDate",
        "minutes",
        "points",
        "rebounds",
        "assists",
        "steals",
        "blocks",
        "turnovers",
        "fieldGoalsMade",
        "fieldGoalsAttempted",
        "threePointersMade",
        "threePointersAttempted",
        "freeThrowsMade",
        "freeThrowsAttempted"
      FROM "PlayerGameLog"
      WHERE "playerId" = ${player.id}
        AND "gameDate" >= ${seasonStart}
        AND "gameDate" < ${seasonEnd}
      ORDER BY "gameDate" DESC
    `,
    getInjuryIndex(),
  ]);

  const latestSeason = seasonStats[0] ?? null;
  const injury = getPlayerInjury(player, injuries);

  return {
    player: {
      id: player.id,
      nbaPersonId: player.nbaPersonId,
      firstName: player.firstName,
      lastName: player.lastName,
      fullName: player.fullName,
      teamAbbr: player.teamAbbr,
      teamName: player.teamName,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      isActive: player.isActive,
      isRookie: isRookieForLeagueYear(
        "fromYear" in player ? (player.fromYear as number | null) : null,
      ),
      isInjured: injury != null,
      injuryLabel: injury?.label ?? null,
      injuryUrl: injury?.url ?? null,
    },
    seasonStats: latestSeason
      ? {
          season: latestSeason.season,
          gamesPlayed: latestSeason.gamesPlayed,
          minutes: Number(latestSeason.minutes),
          points: Number(latestSeason.points),
          rebounds: Number(latestSeason.rebounds),
          assists: Number(latestSeason.assists),
          steals: Number(latestSeason.steals),
          blocks: Number(latestSeason.blocks),
          turnovers: Number(latestSeason.turnovers),
          fieldGoalsMade: Number(latestSeason.fieldGoalsMade),
          fieldGoalsAttempted: Number(latestSeason.fieldGoalsAttempted),
          threePointersMade: Number(latestSeason.threePointersMade),
          threePointersAttempted: Number(latestSeason.threePointersAttempted),
          freeThrowsMade: Number(latestSeason.freeThrowsMade),
          freeThrowsAttempted: Number(latestSeason.freeThrowsAttempted),
        }
      : null,
    recentGames: recentGames.map(serializeGame),
    seasonFantasy: {
      season: FANTASY_AVERAGE_SEASON,
      gamesPlayed: seasonGames.length,
      averageFantasyPoints:
        seasonGames.length === 0
          ? null
          : seasonGames.reduce((sum, game) => sum + scoreFantasyGame(toBox(game)).fantasyPoints, 0) /
            seasonGames.length,
      games: seasonGames.map(serializeGame),
    },
  };
}

function toBox(game: GameLogRow) {
  return {
    points: Number(game.points),
    rebounds: Number(game.rebounds),
    assists: Number(game.assists),
    steals: Number(game.steals),
    blocks: Number(game.blocks),
    turnovers: Number(game.turnovers),
    threePointersMade: Number(game.threePointersMade),
  };
}

function serializeGame(game: GameLogRow) {
  const box = toBox(game);
  const fantasy = scoreFantasyGame(box);
  const gameDate = game.gameDate instanceof Date ? game.gameDate : new Date(game.gameDate);
  return {
    gameId: game.gameId,
    gameDate: gameDate.toISOString(),
    minutes: Number(game.minutes),
    points: box.points,
    rebounds: box.rebounds,
    assists: box.assists,
    steals: box.steals,
    blocks: box.blocks,
    turnovers: box.turnovers,
    fieldGoalsMade: Number(game.fieldGoalsMade),
    fieldGoalsAttempted: Number(game.fieldGoalsAttempted),
    threePointersMade: box.threePointersMade,
    threePointersAttempted: Number(game.threePointersAttempted),
    freeThrowsMade: Number(game.freeThrowsMade),
    freeThrowsAttempted: Number(game.freeThrowsAttempted),
    fantasyPoints: fantasy.fantasyPoints,
    doubleDouble: fantasy.doubleDouble,
    tripleDouble: fantasy.tripleDouble,
  };
}
