import { describe, expect, it } from "vitest";
import { buildLockInDataset, extractPlayers } from "@/lib/statdunk/normalize";

const jokic = {
  canonicalPlayerId: "abc",
  sleeperPlayerId: "1658",
  displayName: "Nikola Jokic",
  teamAbbreviation: "DEN",
  fantasyPositions: ["C"],
  teamIdAtCutoff: "1610612743",
  projectedGames: 65,
  projectedMinutes: 2300,
  projectedTotalFpts: 4200,
  projectedFptsPerGame: 64.6,
  pointsRanks: { totals: 1, averages: 1 },
  lockIn: { totalRank: 1, averageRank: 1, expectedLockedInTotal: 1659, expectedFptsPerActiveWeek: 73.275 },
};

describe("statdunk normalize", () => {
  it("extracts players from a release envelope", () => {
    expect(extractPlayers({ release: { players: [jokic] } })).toHaveLength(1);
  });

  it("joins overlapping table records onto the v3 player", () => {
    const dataset = buildLockInDataset({
      v3Payload: { release: { publication: { label: "test" }, players: [jokic, { ...jokic, canonicalPlayerId: "def", sleeperPlayerId: "2", displayName: "Other", lockIn: { totalRank: 2 } }] } },
      tablePayload: {
        access: { previewLimit: 40, totalPlayerCount: 2 },
        release: { players: [jokic], fptsPercentiles: { "1658": 89 } },
      },
      v3Meta: {
        name: "v3LockIn",
        url: "v3",
        playerCount: 2,
        totalPlayerCount: 2,
        previewLimited: false,
        publication: null,
        access: null,
      },
      tableMeta: {
        name: "projectionTable",
        url: "table",
        playerCount: 1,
        totalPlayerCount: 2,
        previewLimited: true,
        publication: null,
        access: null,
      },
    });

    expect(dataset.players).toHaveLength(2);
    expect(dataset.players[0]?.sources).toEqual(["v3LockIn", "projectionTable"]);
    expect(dataset.players[0]?.tableFptsPercentile).toBe(89);
    expect(dataset.players[0]?.expectedFptsPerActiveWeek).toBe(73.275);
    expect(dataset.players[0]?.expectedFptsPerActiveWeekRank).toBe(1);
    expect(dataset.players[1]?.sources).toEqual(["v3LockIn"]);
    expect(dataset.players[1]?.expectedFptsPerActiveWeekRank).toBeNull();
  });
});
