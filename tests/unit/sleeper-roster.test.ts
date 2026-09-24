import { describe, expect, it } from "vitest";
import { diffDraftPicks } from "@/lib/sleeper/tracker/diff";
import {
  calculateRosterNeeds,
  defaultNbaRosterRequirements,
  evaluateFavoriteLineup,
  getPlayerEligibleSlots,
  getUserPicks,
  parseNbaPositions,
  parseRosterRequirements,
  sleeperPositionLabel,
  toDraftedRosterPlayers,
} from "@/lib/sleeper/roster";
import type { DraftPick } from "@/lib/sleeper/tracker/types";

const STANDARD = parseRosterRequirements({
  settings: {
    slots_pg: 1,
    slots_sg: 1,
    slots_g: 1,
    slots_sf: 1,
    slots_pf: 1,
    slots_f: 1,
    slots_c: 1,
    slots_util: 2,
    teams: 8,
    rounds: 15,
  },
});

function player(id: string, label: string, positions: string) {
  return toDraftedRosterPlayers([{ pickNo: Number(id), playerId: id, label, positions }])[0]!;
}

function slot(state: ReturnType<typeof calculateRosterNeeds>, position: string) {
  return state.rosterSlots.find((item) => item.position === position);
}

function pick(pickNo: number, playerId: string, pickedBy: string): DraftPick {
  return { pickNo, playerId, pickedBy, draftSlot: null, round: null };
}

describe("parseRosterRequirements", () => {
  it("maps Sleeper slot settings", () => {
    expect(
      parseRosterRequirements({
        settings: {
          slots_pg: 1,
          slots_sg: 1,
          slots_g: 1,
          slots_sf: 1,
          slots_pf: 1,
          slots_f: 1,
          slots_c: 1,
          slots_util: 2,
          teams: 8,
          rounds: 15,
        },
      }),
    ).toEqual({
      PG: 1,
      SG: 1,
      G: 1,
      SF: 1,
      PF: 1,
      F: 1,
      C: 1,
      UTIL: 2,
      bench: 0,
      teams: 8,
      rounds: 15,
    });
  });

  it("treats missing settings as 0", () => {
    expect(parseRosterRequirements()).toEqual({
      PG: 0,
      SG: 0,
      G: 0,
      SF: 0,
      PF: 0,
      F: 0,
      C: 0,
      UTIL: 0,
      bench: 0,
      teams: 0,
      rounds: 0,
    });
  });

  it("counts league roster_positions when slot settings are absent", () => {
    expect(
      parseRosterRequirements({
        rosterPositions: ["PG", "SG", "G", "SF", "PF", "F", "C", "UTIL", "UTIL", "BN", "BN"],
        teams: 14,
        rounds: 14,
      }),
    ).toMatchObject({
      PG: 1,
      UTIL: 2,
      bench: 2,
      teams: 14,
      rounds: 14,
    });
  });

  it("reads bench slots from draft settings", () => {
    expect(
      parseRosterRequirements({
        settings: { slots_pg: 1, slots_bn: 5, rounds: 14, teams: 14 },
      }),
    ).toMatchObject({
      PG: 1,
      bench: 5,
      rounds: 14,
    });
  });
});

describe("getPlayerEligibleSlots", () => {
  it("maps single-position players", () => {
    expect(getPlayerEligibleSlots("PG").sort()).toEqual(["G", "PG", "UTIL"]);
    expect(getPlayerEligibleSlots("SG").sort()).toEqual(["G", "SG", "UTIL"]);
    expect(getPlayerEligibleSlots("SF").sort()).toEqual(["F", "SF", "UTIL"]);
    expect(getPlayerEligibleSlots("PF").sort()).toEqual(["F", "PF", "UTIL"]);
    expect(getPlayerEligibleSlots("C").sort()).toEqual(["C", "UTIL"]);
  });

  it("maps multi-position players onto fixed and flexible slots", () => {
    expect(getPlayerEligibleSlots("PG/SG").sort()).toEqual(["G", "PG", "SG", "UTIL"]);
    expect(getPlayerEligibleSlots(["SF", "PF"]).sort()).toEqual(["F", "PF", "SF", "UTIL"]);
    expect(getPlayerEligibleSlots(["SF", "SG"]).sort()).toEqual(["F", "G", "SF", "SG", "UTIL"]);
    expect(getPlayerEligibleSlots("PF/SF").sort()).toEqual(["F", "PF", "SF", "UTIL"]);
  });

  it("keeps Sleeper combo labels such as PF/SF and SG/SF", () => {
    expect(sleeperPositionLabel(["SF", "SG"])).toBe("SG/SF");
    expect(sleeperPositionLabel("sg / sf")).toBe("SG/SF");
    expect(sleeperPositionLabel("PF/SF")).toBe("SF/PF");
    expect(sleeperPositionLabel("C")).toBe("C");
  });

  it("lets any eligible player fill UTIL", () => {
    expect(getPlayerEligibleSlots("C")).toContain("UTIL");
    expect(getPlayerEligibleSlots("PG/SG")).toContain("UTIL");
    expect(parseNbaPositions("G-F")).toEqual(expect.arrayContaining(["G", "F"]));
  });
});

describe("calculateRosterNeeds", () => {
  it("shows empty pre-draft configuration", () => {
    const state = calculateRosterNeeds(STANDARD, []);
    expect(state.filledRosterSpots).toBe(0);
    expect(state.starterSpots).toBe(9);
    expect(state.totalRosterSpots).toBe(15);
    expect(slot(state, "PG")?.status).toBe("needed");
    expect(slot(state, "UTIL")?.remaining).toBe(2);
  });

  it("fulfills PG after a dedicated PG is drafted", () => {
    const afterPg = calculateRosterNeeds(STANDARD, [player("1", "A", "PG")]);
    expect(slot(afterPg, "PG")?.status).toBe("fulfilled");
    expect(slot(afterPg, "C")?.status).toBe("needed");

    const afterC = calculateRosterNeeds(STANDARD, [player("1", "A", "PG"), player("2", "B", "C")]);
    expect(slot(afterC, "PG")?.status).toBe("fulfilled");
    expect(slot(afterC, "C")?.status).toBe("fulfilled");
    expect(afterC.filledRosterSpots).toBe(2);
    expect(afterC.positionCounts).toEqual([
      { position: "C", count: 1, players: ["B"] },
      { position: "PG", count: 1, players: ["A"] },
    ]);
    expect(slot(afterC, "PG")?.players).toEqual(["A"]);
    expect(slot(afterC, "C")?.players).toEqual(["B"]);
  });

  it("counts Sleeper combo positions as a single label", () => {
    const state = calculateRosterNeeds(STANDARD, [
      player("1", "A", "SG/SF"),
      player("2", "B", "PF/SF"),
      player("3", "C", "SG/SF"),
    ]);
    expect(state.positionCounts).toEqual([
      { position: "SG/SF", count: 2, players: ["A", "C"] },
      { position: "SF/PF", count: 1, players: ["B"] },
    ]);
    expect(slot(state, "SG")?.players).toEqual(["A", "C"]);
    expect(slot(state, "SF")?.players).toEqual(["A", "B", "C"]);
    expect(slot(state, "PF")?.players).toEqual(["B"]);
  });

  it("does not treat a PG/SG as permanently fulfilling PG when SG is also required", () => {
    const state = calculateRosterNeeds(STANDARD, [player("1", "A", "PG/SG")]);
    expect(slot(state, "PG")?.status).toBe("at_risk");
    expect(slot(state, "SG")?.status).toBe("at_risk");
  });

  it("lets SF/PF fill forward flex after fixed forwards are considered", () => {
    const state = calculateRosterNeeds(STANDARD, [
      player("1", "A", "SF"),
      player("2", "B", "PF"),
      player("3", "C", "SF/PF"),
    ]);
    expect(slot(state, "SF")?.status).toBe("fulfilled");
    expect(slot(state, "PF")?.status).toBe("fulfilled");
    expect(slot(state, "F")?.status).toBe("fulfilled");
  });

  it("fills two UTIL slots with leftover eligible players", () => {
    const state = calculateRosterNeeds(STANDARD, [
      player("1", "PG", "PG"),
      player("2", "SG", "SG"),
      player("3", "SF", "SF"),
      player("4", "PF", "PF"),
      player("5", "C", "C"),
      player("6", "G", "SG"),
      player("7", "U1", "PG"),
      player("8", "U2", "C"),
    ]);
    expect(slot(state, "UTIL")?.status).toBe("fulfilled");
    expect(slot(state, "UTIL")?.filled).toBe(2);
  });

  it("ignores another team's picks", () => {
    const mine = getUserPicks(
      [
        { ...pick(1, "a", "me"), metadata: { first_name: "A" } },
        { ...pick(2, "b", "other"), metadata: { first_name: "B" } },
      ],
      "me",
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]?.playerId).toBe("a");
  });
});

describe("draft changes and corrections", () => {
  it("recalculates when picks are added, removed, or changed", () => {
    const empty = calculateRosterNeeds(STANDARD, []);
    expect(slot(empty, "PG")?.status).toBe("needed");

    let players = [player("1", "A", "PG")];
    expect(slot(calculateRosterNeeds(STANDARD, players), "PG")?.status).toBe("fulfilled");

    players = [...players, player("2", "B", "C")];
    expect(slot(calculateRosterNeeds(STANDARD, players), "C")?.status).toBe("fulfilled");

    const previous = [pick(1, "a", "me"), pick(2, "b", "me")];
    const removed = diffDraftPicks(previous, [pick(1, "a", "me")]);
    expect(removed.removed.map((item) => item.pickNo)).toEqual([2]);

    const changed = diffDraftPicks([pick(1, "a", "me")], [pick(1, "c", "me")]);
    expect(changed.changed[0]?.current.playerId).toBe("c");
  });
});

describe("evaluateFavoriteLineup", () => {
  it("treats a full Sleeper NBA set as a legal team", () => {
    const players = [
      player("1", "PG", "PG"),
      player("2", "SG", "SG"),
      player("3", "G", "SG"),
      player("4", "SF", "SF"),
      player("5", "PF", "PF"),
      player("6", "F", "SF"),
      player("7", "C", "C"),
      player("8", "U1", "PG"),
      player("9", "U2", "C"),
    ];
    const result = evaluateFavoriteLineup(STANDARD, players);
    expect(result.status).toBe("legal");
    expect(result.missingPositions).toEqual([]);
    expect(result.startersFilled).toBe(9);
  });

  it("uses 1 PG/SG/G/SF/PF/F/C, 2 UTIL, and 4 BN", () => {
    const requirements = defaultNbaRosterRequirements();
    expect(requirements).toMatchObject({
      PG: 1,
      SG: 1,
      G: 1,
      SF: 1,
      PF: 1,
      F: 1,
      C: 1,
      UTIL: 2,
      bench: 4,
    });
    const result = evaluateFavoriteLineup(requirements, [player("1", "Jokic", "C")]);
    expect(result.assignment.filter((slot) => slot.position === "BN")).toHaveLength(4);
    expect(result.rosterSpots).toBe(13);
    expect(result.starterSpots).toBe(9);
  });

  it("is incomplete when starters are still open and nobody is leftover", () => {
    const result = evaluateFavoriteLineup(STANDARD, [player("1", "Jokic", "C")]);
    expect(result.status).toBe("incomplete");
    expect(result.missingPositions).toContain("PG");
  });

  it("is illegal when leftover favorites cannot fill remaining starter slots", () => {
    const result = evaluateFavoriteLineup(STANDARD, [
      player("1", "A", "C"),
      player("2", "B", "C"),
      player("3", "C", "C"),
      player("4", "D", "C"),
    ]);
    expect(result.status).toBe("illegal");
    expect(result.missingPositions.length).toBeGreaterThan(0);
    expect(result.overflow.length + result.bench.length).toBeGreaterThan(0);
  });
});
