import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseNbaStatsBundle } from "@/lib/nba/python";
import { averageFantasyPoints, parseFantasyScoring, scoreFantasyGame } from "@/lib/nba/fantasy";
import { getPlayerDetail } from "@/lib/nba/player-detail";
import { resetInjuryCacheForTests } from "@/lib/nba/injuries";
import { mapStatsToKnownPlayers, persistGameLogs, persistSeasonStats, recentGameLogsQuery } from "@/lib/nba/stats-upsert";
import { resetStatsSyncInFlightForTests, syncNbaStats } from "@/lib/nba/stats-sync";

const seasonRow = {
  nbaPersonId: 2544,
  season: "2025-26",
  gamesPlayed: 65,
  minutes: 35.4,
  points: 25.4,
  rebounds: 7.8,
  assists: 8.1,
  steals: 1.1,
  blocks: 0.6,
  turnovers: 3.2,
  fieldGoalsMade: 9.1,
  fieldGoalsAttempted: 18.2,
  threePointersMade: 2.1,
  threePointersAttempted: 6,
  freeThrowsMade: 5.1,
  freeThrowsAttempted: 6.4,
};

const gameRow = {
  nbaPersonId: 2544,
  gameId: "0022500001",
  gameDate: "2026-04-10",
  minutes: 31,
  points: 30,
  rebounds: 8,
  assists: 9,
  steals: 2,
  blocks: 1,
  turnovers: 3,
  fieldGoalsMade: 11,
  fieldGoalsAttempted: 22,
  threePointersMade: 3,
  threePointersAttempted: 8,
  freeThrowsMade: 5,
  freeThrowsAttempted: 6,
};

describe("fantasy scoring", () => {
  it("scores counting stats and a double-double without stacking a triple-double", () => {
    const double = scoreFantasyGame({
      points: 12,
      rebounds: 10,
      assists: 3,
      steals: 1,
      blocks: 0,
      turnovers: 2,
      threePointersMade: 2,
    });
    expect(double.doubleDouble).toBe(true);
    expect(double.tripleDouble).toBe(false);
    expect(double.fantasyPoints).toBe(12 + 10 + 6 + 4 + 0 - 4 + 2 + 2);

    const triple = scoreFantasyGame({
      points: 10,
      rebounds: 10,
      assists: 10,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      threePointersMade: 0,
    });
    expect(triple.tripleDouble).toBe(true);
    expect(triple.fantasyPoints).toBe(10 + 10 + 20 + 4);
  });

  it("applies custom scoring and a 50-point bonus", () => {
    const parsed = parseFantasyScoring({ points: 2, points50: 5, assists: 0 });
    const scored = scoreFantasyGame(
      {
        points: 50,
        rebounds: 0,
        assists: 8,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        threePointersMade: 0,
      },
      parsed,
    );
    expect(parsed.assists).toBe(0);
    expect(scored.fantasyPoints).toBe(100 + 5);
  });

  it("averages fantasy points across a full season of games", () => {
    const games = [
      {
        points: 10,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        threePointersMade: 0,
      },
      {
        points: 20,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        threePointersMade: 0,
      },
    ];
    expect(averageFantasyPoints(games)).toBe(15);
  });
});

describe("stats bundle parsing", () => {
  it("keeps normalized stats and counts malformed rows", () => {
    const parsed = parseNbaStatsBundle({
      seasonStats: [seasonRow, { nbaPersonId: "bad" }],
      gameLogs: [gameRow],
      errors: ["game logs 2026-27 Playoffs: empty"],
    });
    expect(parsed.seasonStats).toHaveLength(1);
    expect(parsed.gameLogs).toHaveLength(1);
    expect(parsed.parseFailed).toBe(1);
  });
});

describe("stats upserts", () => {
  it("maps NBA ids onto existing players and skips unknown ids", () => {
    const result = mapStatsToKnownPlayers([seasonRow, { ...seasonRow, nbaPersonId: 99 }], new Map([[2544, "player-1"]]));
    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0]?.playerId).toBe("player-1");
    expect(result.skipped).toBe(1);
  });

  it("upserts season stats and game logs with conflict targets", async () => {
    const db = { $executeRaw: vi.fn().mockResolvedValue(1) };
    const now = new Date("2026-09-13T00:00:00.000Z");

    await persistSeasonStats(db as never, [{ ...seasonRow, playerId: "player-1" }], now);
    await persistGameLogs(db as never, [{ ...gameRow, playerId: "player-1" }], now);
    await persistSeasonStats(db as never, [{ ...seasonRow, playerId: "player-1", points: 26 }], now);

    expect(db.$executeRaw).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(db.$executeRaw.mock.calls[0])).toContain("ON CONFLICT");
  });

  it("requests the latest 10 games by date", () => {
    expect(recentGameLogsQuery("player-1", 10)).toEqual({
      where: { playerId: "player-1" },
      orderBy: { gameDate: "desc" },
      take: 10,
    });
  });
});

describe("syncNbaStats", () => {
  beforeEach(() => {
    resetStatsSyncInFlightForTests();
  });

  function makeDb() {
    return {
      nbaSyncState: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      player: {
        findMany: vi.fn().mockResolvedValue([{ id: "player-1", nbaPersonId: 2544 }]),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
  }

  it("upserts bulk stats for known players", async () => {
    const db = makeDb();
    const result = await syncNbaStats(
      {},
      {
        prisma: db as never,
        now: () => new Date("2026-09-13T00:00:00.000Z"),
        fetchBundle: async () => ({
          seasonStats: [seasonRow],
          gameLogs: [gameRow],
          errors: [],
        }),
      },
    );

    expect(result.success).toBe(true);
    expect(result.playersProcessed).toBe(1);
    expect(result.seasonStatsProcessed).toBe(1);
    expect(result.gameLogsProcessed).toBe(1);
    expect(db.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("syncs an individual player by NBA id", async () => {
    const db = makeDb();
    const fetchBundle = vi.fn().mockResolvedValue({
      seasonStats: [seasonRow],
      gameLogs: [gameRow],
      errors: [],
    });

    await syncNbaStats(
      { playerId: 2544 },
      {
        prisma: db as never,
        now: () => new Date("2026-09-13T00:00:00.000Z"),
        fetchBundle,
      },
    );

    expect(fetchBundle).toHaveBeenCalledWith(2544);
  });
});

describe("GET player detail", () => {
  beforeEach(() => {
    resetInjuryCacheForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ injuries: [] }),
      }),
    );
  });

  it("returns season averages and scored recent games", async () => {
    const db = {
      player: {
        findFirst: vi.fn().mockResolvedValue({
          id: "player-1",
          nbaPersonId: 2544,
          firstName: "LeBron",
          lastName: "James",
          fullName: "LeBron James",
          teamAbbr: "LAL",
          teamName: "Los Angeles Lakers",
          position: "F",
          jerseyNumber: "23",
          isActive: true,
          fromYear: 2003,
        }),
      },
      playerSeasonStats: {
        findMany: vi.fn(),
      },
      playerGameLog: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn(async (...args: unknown[]) => {
        const sql = JSON.stringify(args);
        if (sql.includes("PlayerSeasonStats")) {
          return [{ ...seasonRow, playerId: "player-1" }];
        }
        const extraGame = {
          ...gameRow,
          gameId: "0022500002",
          points: 10,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          threePointersMade: 0,
          gameDate: new Date("2026-01-15T00:00:00.000Z"),
        };
        if (sql.includes("LIMIT 10")) {
          return [
            {
              ...gameRow,
              playerId: "player-1",
              gameDate: new Date("2026-04-10T00:00:00.000Z"),
            },
          ];
        }
        return [
          {
            ...gameRow,
            playerId: "player-1",
            gameDate: new Date("2026-04-10T00:00:00.000Z"),
          },
          extraGame,
        ];
      }),
    };

    const detail = await getPlayerDetail("player-1", db as never);

    expect(detail?.player.fullName).toBe("LeBron James");
    expect(detail?.seasonStats?.points).toBe(25.4);
    expect(detail?.recentGames).toHaveLength(1);
    expect(detail?.seasonFantasy.gamesPlayed).toBe(2);
    expect(detail?.seasonFantasy.averageFantasyPoints).toBe(
      ((30 + 8 + 18 + 8 + 4 - 6 + 3) + 10) / 2,
    );
    expect(db.$queryRaw).toHaveBeenCalled();
  });
});
