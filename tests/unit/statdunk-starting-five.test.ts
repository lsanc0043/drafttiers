import { describe, expect, it } from "vitest";
import { predictedDepthChart, predictedStartingFive } from "@/lib/statdunk/starting-five";
import type { StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

function player(
  name: string,
  team: string,
  positions: string[],
  minutes: number,
): StatdunkNormalizedPlayer {
  return {
    playerName: name,
    nbaPersonId: null,
    nbaTeamId: null,
    sleeperPlayerId: name,
    canonicalPlayerId: name,
    team,
    position: positions.join("/"),
    fantasyPositions: positions,
    gamesPlayed: 1,
    minutes,
    usage: null,
    fantasyPoints: 0,
    fantasyPointsPerGame: 0,
    pointsRankTotals: null,
    pointsRankAverages: null,
    lockInTotalRank: null,
    lockInAverageRank: null,
    lockInRegularPerGameRank: null,
    lockInExpectedTotal: null,
    lockInP10Total: null,
    lockInP50Total: null,
    lockInP90Total: null,
    lockInLiDelta: null,
    expectedFptsPerActiveWeek: null,
    expectedFptsPerActiveWeekRank: null,
    tableFptsPercentile: null,
    sources: ["v3LockIn"],
    original: {
      v3LockIn: { projectedStats: { min: minutes } },
      projectionTable: null,
    },
  };
}

describe("predicted starting five", () => {
  it("assigns the highest-minute player to each starting slot", () => {
    const starters = predictedStartingFive(
      [
        player("Jokic", "DEN", ["C"], 36),
        player("Murray", "DEN", ["PG"], 34),
        player("Gordon", "DEN", ["PF"], 32),
        player("Braun", "DEN", ["SG"], 30),
        player("Porter", "DEN", ["SF"], 29),
        player("Westbrook", "DEN", ["PG"], 22),
        player("SGA", "OKC", ["PG"], 37),
      ],
      "den",
    );

    expect(starters.map((row) => `${row.slot}:${row.player.playerName}`)).toEqual([
      "PG:Murray",
      "SG:Braun",
      "SF:Porter",
      "PF:Gordon",
      "C:Jokic",
    ]);
  });

  it("uses combo positions then fills leftover slots by minutes", () => {
    const starters = predictedStartingFive(
      [
        player("Guard", "BOS", ["PG", "SG"], 38),
        player("Wing", "BOS", ["SF"], 34),
        player("Big", "BOS", ["C"], 32),
        player("Forward", "BOS", ["PF"], 30),
        player("Bench big", "BOS", ["C"], 28),
      ],
      "BOS",
    );

    expect(starters.map((row) => `${row.slot}:${row.player.playerName}`)).toEqual([
      "PG:Guard",
      "SG:Bench big",
      "SF:Wing",
      "PF:Forward",
      "C:Big",
    ]);
  });

  it("fills starter, 2nd, and 3rd uniquely by position", () => {
    const chart = predictedDepthChart(
      [
        player("Murray", "DEN", ["PG"], 34),
        player("Westbrook", "DEN", ["PG"], 22),
        player("Pickett", "DEN", ["PG"], 12),
        player("Braun", "DEN", ["SG"], 30),
        player("Watson", "DEN", ["SG"], 18),
        player("Porter", "DEN", ["SF"], 29),
        player("Gordon", "DEN", ["PF"], 32),
        player("Jokic", "DEN", ["C"], 36),
        player("Nnaji", "DEN", ["C"], 10),
      ],
      "DEN",
    );

    expect(
      chart.map((row) =>
        `${row.slot}:${row.depth.map((cell) => cell?.player.playerName ?? "—").join("/")}`,
      ),
    ).toEqual([
      "PG:Murray/Westbrook/Pickett",
      "SG:Braun/Watson/—",
      "SF:Porter/—/—",
      "PF:Gordon/—/—",
      "C:Jokic/Nnaji/—",
    ]);
  });
});
