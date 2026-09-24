import { describe, expect, it } from "vitest";
import {
  addBoardGroup,
  deleteBucketGroup,
  parseBucketGroups,
  setPlayerGroup,
} from "@/lib/board-groups";
import type { BoardBucket, BoardBucketPlayer } from "@/types";

function player(id: string): BoardBucketPlayer {
  return {
    assignmentId: id,
    playerId: id,
    nbaPersonId: 1,
    fullName: id,
    teamAbbr: "DEN",
    teamName: "Nuggets",
    position: "C",
    jerseyNumber: "15",
    isActive: true,
    sortOrder: 0,
    notes: null,
    favorited: false,
  };
}

function bucket(id: string, players: BoardBucketPlayer[] = []): BoardBucket {
  return {
    id,
    name: id,
    color: "#808080",
    sortOrder: 0,
    groups: [],
    players,
  };
}

describe("board groups", () => {
  it("parses stored subcategory json", () => {
    expect(
      parseBucketGroups([
        { id: "g1", name: "Guards", color: "#3b82f6", playerIds: ["a", "a", "b"] },
      ]),
    ).toEqual([{ id: "g1", name: "Guards", color: "#3b82f6", playerIds: ["a", "b"] }]);
  });

  it("creates a subcategory and can return a player to the tier", () => {
    const withGroup = addBoardGroup([bucket("S", [player("luka"), player("sga")])], {
      id: "g1",
      name: "Guards",
      color: "#3b82f6",
      playerIds: ["luka", "sga"],
    });
    expect(withGroup[0]?.groups[0]?.playerIds).toEqual(["luka", "sga"]);
    const ungrouped = setPlayerGroup(withGroup, "luka", "S", null);
    expect(ungrouped[0]?.groups[0]?.playerIds).toEqual(["sga"]);
  });

  it("keeps subcategory members on their own tiers", () => {
    const withGroup = addBoardGroup(
      [bucket("S", [player("luka")]), bucket("A", [player("sga")])],
      {
        id: "g1",
        name: "Guards",
        color: "#3b82f6",
        playerIds: ["luka", "sga"],
      },
    );
    expect(withGroup[0]?.groups[0]).toMatchObject({ id: "g1", name: "Guards", playerIds: ["luka"] });
    expect(withGroup[1]?.groups[0]).toMatchObject({ id: "g1", name: "Guards", playerIds: ["sga"] });
    expect(withGroup[0]?.players.map((item) => item.playerId)).toEqual(["luka"]);
    expect(withGroup[1]?.players.map((item) => item.playerId)).toEqual(["sga"]);
  });

  it("deletes a subcategory without dropping players from the tier", () => {
    const withGroup = addBoardGroup([bucket("S", [player("luka")])], {
      id: "g1",
      name: "Guards",
      color: "#3b82f6",
      playerIds: ["luka"],
    });
    const next = deleteBucketGroup(withGroup, "g1");
    expect(next[0]?.groups).toEqual([]);
    expect(next[0]?.players.map((item) => item.playerId)).toEqual(["luka"]);
  });
});
