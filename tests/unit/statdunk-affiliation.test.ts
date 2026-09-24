import { describe, expect, it } from "vitest";
import {
  applyLockInTeam,
  findLockInPlayer,
  lockInTeamPlayers,
} from "@/lib/statdunk/affiliation";
import type { StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

function player(
  name: string,
  team: string,
  extras: Partial<StatdunkNormalizedPlayer> = {},
): StatdunkNormalizedPlayer {
  return {
    playerName: name,
    nbaPersonId: extras.nbaPersonId ?? null,
    nbaTeamId: null,
    sleeperPlayerId: extras.sleeperPlayerId ?? name,
    canonicalPlayerId: extras.canonicalPlayerId ?? name,
    team,
    position: "F",
    fantasyPositions: ["SF"],
    gamesPlayed: 60,
    minutes: 2000,
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
    expectedFptsPerActiveWeek: 40,
    expectedFptsPerActiveWeekRank: 20,
    tableFptsPercentile: null,
    sources: ["v3LockIn"],
    original: { v3LockIn: null, projectionTable: null },
  };
}

describe("lock-in 2026-27 affiliation", () => {
  it("uses Lock-In team over last season's directory club", () => {
    const card = applyLockInTeam(
      {
        id: "kawhi",
        nbaPersonId: 202695,
        fullName: "Kawhi Leonard",
        teamAbbr: "LAC",
        teamName: "LA Clippers",
        position: "F",
        jerseyNumber: "2",
        isActive: true,
        isRookie: false,
      },
      "TOR",
    );
    expect(card.teamAbbr).toBe("TOR");
    expect(card.teamName).toBe("Toronto Raptors");
  });

  it("finds a player by headshot id and lists only that Lock-In team", () => {
    const kawhi = player("Kawhi Leonard", "TOR");
    const clipper = player("Ivica Zubac", "LAC");
    const raptor = player("RJ Barrett", "TOR");
    const photoIds = { "Kawhi Leonard": 202695, "Ivica Zubac": 1627826, "RJ Barrett": 1629628 };

    expect(
      findLockInPlayer([kawhi, clipper, raptor], photoIds, { nbaPersonId: 202695 })?.team,
    ).toBe("TOR");
    expect(lockInTeamPlayers([kawhi, clipper, raptor], "TOR").map((row) => row.playerName)).toEqual(
      ["Kawhi Leonard", "RJ Barrett"],
    );
  });
});
