import { describe, expect, it } from "vitest";
import {
  formatGameLogMatchup,
  gameLogRowTone,
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

  it("colors played games against season average FPTS", () => {
    expect(gameLogRowTone(20, 15, false)).toBe("above");
    expect(gameLogRowTone(16, 15, false)).toBe("average");
    expect(gameLogRowTone(12, 15, false)).toBe("below");
    expect(gameLogRowTone(0, 15, true)).toBe("dnp");
  });
});
