import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { gameLogBucket, likelySeasonTeams, mergeSeasonGameLog } from "@/lib/nba/game-log";
import { scoreFantasyGame } from "@/lib/nba/fantasy";
import { getInjuryIndex, getPlayerInjury } from "@/lib/nba/injuries";
import { teamUsageMap, teamUsageTotals } from "@/lib/nba/players";
import { FANTASY_AVERAGE_SEASON, GAME_LOG_SEASONS, gameLogDateRange, isRookieForLeagueYear } from "@/lib/nba/season";
import { usageRateFromPerGame } from "@/lib/nba/usage";

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

type TeamGameRow = {
  gameId: string;
  gameDate: Date;
  opponentAbbr?: string | null;
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

  const { start: seasonStart, end: seasonEnd } = gameLogDateRange();
  const teamId = "teamId" in player ? (player.teamId as number | null) : null;

  const [seasonStats, seasonGames, teamGames, teamUsage, injuries] = await Promise.all([
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
        AND "gameDate" >= ${seasonStart}
        AND "gameDate" < ${seasonEnd}
      ORDER BY "gameDate" DESC
    `,
    loadTeamSchedule(db, player.id, teamId, seasonStart, seasonEnd),
    teamUsageTotals(db, FANTASY_AVERAGE_SEASON),
    getInjuryIndex(),
  ]);

  const latestSeason = seasonStats[0] ?? null;
  const teamBox = teamId != null ? teamUsageMap(teamUsage).get(teamId) : undefined;
  const usageRateValue =
    latestSeason && teamBox
      ? usageRateFromPerGame(
          {
            fieldGoalsAttempted: Number(latestSeason.fieldGoalsAttempted),
            freeThrowsAttempted: Number(latestSeason.freeThrowsAttempted),
            turnovers: Number(latestSeason.turnovers),
            minutes: Number(latestSeason.minutes),
          },
          teamBox,
          latestSeason.gamesPlayed,
        )
      : null;
  const injury = getPlayerInjury(player, injuries);
  const playedGames = seasonGames.map((game) => ({ ...serializeGame(game), didNotPlay: false }));
  const gameLog = mergeSeasonGameLog(
    playedGames,
    teamGames.map((game) => ({
      gameId: game.gameId,
      gameDate: (game.gameDate instanceof Date ? game.gameDate : new Date(game.gameDate)).toISOString(),
      opponentAbbr: game.opponentAbbr ?? null,
    })),
  ).filter((game) => gameLogBucket(game.gameId, game.gameDate) != null);
  const fantasySeasonGames = playedGames.filter(
    (game) => gameLogBucket(game.gameId, game.gameDate)?.season === FANTASY_AVERAGE_SEASON,
  );

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
          usageRate: usageRateValue,
        }
      : null,
    recentGames: gameLog,
    gameLog,
    seasonFantasy: {
      season: FANTASY_AVERAGE_SEASON,
      gamesPlayed: fantasySeasonGames.length,
      averageFantasyPoints:
        fantasySeasonGames.length === 0
          ? null
          : fantasySeasonGames.reduce(
              (sum, game) =>
                sum +
                scoreFantasyGame(
                  toBox({
                    ...game,
                    gameDate: new Date(game.gameDate),
                  }),
                ).fantasyPoints,
              0,
            ) / fantasySeasonGames.length,
      games: fantasySeasonGames,
    },
  };
}

function loadTeamSchedule(
  db: PrismaClient,
  playerId: string,
  teamId: number | null,
  seasonStart: Date,
  seasonEnd: Date,
) {
  return (async () => {
    const counts = await db.$queryRaw<Array<{ teamId: number; season: string; games: number }>>`
      SELECT tg."teamId", tg."season", COUNT(*)::int AS games
      FROM "PlayerGameLog" gl
      INNER JOIN "TeamGame" tg ON tg."gameId" = gl."gameId"
      WHERE gl."playerId" = ${playerId}
        AND gl."gameDate" >= ${seasonStart}
        AND gl."gameDate" < ${seasonEnd}
      GROUP BY tg."teamId", tg."season"
    `;
    const seasonTeams = likelySeasonTeams(counts, {
      currentTeamId: teamId,
      seasons: GAME_LOG_SEASONS,
    });
    if (seasonTeams.length === 0) {
      return [] as TeamGameRow[];
    }
    const tuples = Prisma.join(
      seasonTeams.map((row) => Prisma.sql`(${row.teamId}, ${row.season})`),
    );
    return db.$queryRaw<TeamGameRow[]>`
      SELECT DISTINCT ON (tg."gameId")
        tg."gameId",
        tg."gameDate",
        tg_opp."teamAbbr" AS "opponentAbbr"
      FROM "TeamGame" tg
      INNER JOIN (VALUES ${tuples}) AS st("teamId", "season")
        ON st."teamId" = tg."teamId"
       AND st."season" = tg."season"
      LEFT JOIN "TeamGame" tg_opp
        ON tg_opp."gameId" = tg."gameId"
       AND tg_opp."teamId" <> tg."teamId"
      WHERE tg."gameDate" >= ${seasonStart}
        AND tg."gameDate" < ${seasonEnd}
      ORDER BY tg."gameId", tg_opp."teamAbbr"
    `;
  })();
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
    didNotPlay: false,
  };
}
