import { describe, expect, it } from "vitest";
import { usageRate } from "@/lib/nba/usage";
import { lockInBoxStats, lockInUsageByTeam } from "@/lib/statdunk/box-stats";
import type { StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

function player(name: string, team: string, stats: Record<string, number>): StatdunkNormalizedPlayer {
  return {
    playerName: name,
    nbaPersonId: null,
    nbaTeamId: null,
    sleeperPlayerId: name,
    canonicalPlayerId: name,
    team,
    position: "C",
    fantasyPositions: ["C"],
    gamesPlayed: 65,
    minutes: stats.min,
    usage: null,
    fantasyPoints: 4000,
    fantasyPointsPerGame: 60,
    pointsRankTotals: 1,
    pointsRankAverages: 1,
    lockInTotalRank: 1,
    lockInAverageRank: 1,
    lockInRegularPerGameRank: 1,
    lockInExpectedTotal: 1600,
    lockInP10Total: 1400,
    lockInP50Total: 1600,
    lockInP90Total: 1800,
    lockInLiDelta: 0,
    expectedFptsPerActiveWeek: 70,
    expectedFptsPerActiveWeekRank: 1,
    tableFptsPercentile: null,
    sources: ["v3LockIn"],
    original: {
      v3LockIn: { projectedStats: stats },
      projectionTable: null,
    },
  };
}

describe("lock-in box stats", () => {
  it("divides projected totals by games and computes team usage", () => {
    const jokic = player("Nikola Jokic", "DEN", {
      pts: 1732.88,
      reb: 842.81,
      ast: 688.97,
      stl: 96.99,
      blk: 53.51,
      to: 225.21,
      min: 2341.15,
      fgm: 639.17,
      fga: 1127.07,
      ftm: 346.13,
      fta: 422.89,
      tpm: 108.41,
      tpa: 280.49,
    });
    const teammate = player("Teammate", "DEN", {
      pts: 650,
      reb: 200,
      ast: 150,
      stl: 40,
      blk: 20,
      to: 80,
      min: 1800,
      fgm: 240,
      fga: 520,
      ftm: 100,
      fta: 130,
      tpm: 80,
      tpa: 220,
    });

    const teamUsage = lockInUsageByTeam([jokic, teammate]);
    const box = lockInBoxStats(jokic, teamUsage);
    const team = teamUsage.get("DEN");

    expect(box.pts).toBeCloseTo(1732.88 / 65, 5);
    expect(box.min).toBeCloseTo(2341.15 / 65, 5);
    expect(box.fgPct).toBeCloseTo((100 * 639.17) / 1127.07, 5);
    expect(box.tpm).toBeCloseTo(108.41 / 65, 5);
    expect(team).toBeDefined();
    expect(box.usg).toBeCloseTo(
      usageRate(
        {
          fieldGoalsAttempted: 1127.07,
          freeThrowsAttempted: 422.89,
          turnovers: 225.21,
          minutes: 2341.15,
        },
        team!,
        65,
      ) ?? 0,
      5,
    );
  });
});
