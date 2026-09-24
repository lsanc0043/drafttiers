import { describe, expect, it } from "vitest";
import {
  formatGameLogMatchup,
  gameLogRowTone,
  gameLogStatTone,
  likelySeasonTeams,
  mergeSeasonGameLog,
} from "@/lib/nba/game-log";

describe("season game log", () => {
  it("inserts DNP rows for team games the player missed", () => {
    const merged = mergeSeasonGameLog(
      [
        {
          gameId: "played",
          gameDate: "2026-01-10T00:00:00.000Z",
          minutes: 30,
          points: 20,
          rebounds: 5,
          assists: 5,
          steals: 1,
          blocks: 0,
          turnovers: 2,
          threePointersMade: 2,
        },
      ],
      [
        {
          gameId: "played",
          gameDate: "2026-01-10T00:00:00.000Z",
          opponentAbbr: "BOS",
        },
        {
          gameId: "missed",
          gameDate: "2026-01-12T00:00:00.000Z",
          opponentAbbr: "nyk",
        },
      ],
    );

    expect(merged.map((game) => game.gameId)).toEqual(["missed", "played"]);
    expect(merged.find((game) => game.gameId === "missed")?.didNotPlay).toBe(true);
    expect(merged.find((game) => game.gameId === "played")?.opponentAbbr).toBe("BOS");
    expect(formatGameLogMatchup("2026-04-12T00:00:00.000Z", "bos")).toBe("4/12 vs BOS");
  });

  it("keeps the player's team and ignores frequent playoff opponents", () => {
    expect(
      likelySeasonTeams(
        [
          { teamId: 1610612765, season: "2025-26", games: 82 },
          { teamId: 1610612753, season: "2025-26", games: 11 },
          { teamId: 1610612742, season: "2025-26", games: 4 },
        ],
        { currentTeamId: 1610612765, seasons: ["2025-26"] },
      ),
    ).toEqual([{ teamId: 1610612765, season: "2025-26" }]);
  });

  it("keeps both clubs after a midseason trade", () => {
    expect(
      likelySeasonTeams([
        { teamId: 1610612747, season: "2025-26", games: 40 },
        { teamId: 1610612739, season: "2025-26", games: 30 },
        { teamId: 1610612738, season: "2025-26", games: 4 },
      ]),
    ).toEqual([
      { teamId: 1610612747, season: "2025-26" },
      { teamId: 1610612739, season: "2025-26" },
    ]);
  });

  it("keeps only team-schedule games when a schedule is present", () => {
    const merged = mergeSeasonGameLog(
      [
        {
          gameId: "old-team",
          gameDate: "2026-01-08T00:00:00.000Z",
          minutes: 20,
          points: 10,
          rebounds: 2,
          assists: 2,
          steals: 0,
          blocks: 0,
          turnovers: 1,
          threePointersMade: 1,
        },
      ],
      [{ gameId: "current-team", gameDate: "2026-01-09T00:00:00.000Z", opponentAbbr: "MIA" }],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.gameId).toBe("current-team");
    expect(merged[0]?.didNotPlay).toBe(true);
  });

  it("colors FPTS green through 5 below average, yellow 6-15 below, and red after that", () => {
    expect(gameLogRowTone(40, 30, false)).toBe("above");
    expect(gameLogRowTone(25, 30, false)).toBe("above");
    expect(gameLogRowTone(24, 30, false)).toBe("average");
    expect(gameLogRowTone(15, 30, false)).toBe("average");
    expect(gameLogRowTone(14, 30, false)).toBe("below");
    expect(gameLogRowTone(0, 30, true)).toBe("dnp");
  });

  it("scales other stats off FPTS, not real points, and inverts turnovers", () => {
    expect(gameLogStatTone(22, 20, false, false, 40)).toBe("above");
    expect(gameLogStatTone(17.5, 20, false, false, 40)).toBe("above");
    expect(gameLogStatTone(17.4, 20, false, false, 40)).toBe("average");
    expect(gameLogStatTone(12.5, 20, false, false, 40)).toBe("average");
    expect(gameLogStatTone(12.4, 20, false, false, 40)).toBe("below");
    expect(gameLogStatTone(1, 3, false, true, 40)).toBe("above");
    expect(gameLogStatTone(8, 3, false, true, 40)).toBe("below");
  });
});
