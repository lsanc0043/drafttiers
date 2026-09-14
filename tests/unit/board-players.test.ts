import { describe, expect, it } from "vitest";
import { placeBoardPlayer, removeBoardPlayer, clearBoardPlayers, moveBoardPlayers } from "@/lib/board-players";
import type { BoardBucket, BoardBucketPlayer } from "@/types";

function player(id: string, assignmentId: string, sortOrder: number): BoardBucketPlayer {
  return {
    assignmentId,
    playerId: id,
    nbaPersonId: 1,
    fullName: id,
    teamAbbr: "DEN",
    teamName: "Nuggets",
    position: "C",
    jerseyNumber: "15",
    isActive: true,
    sortOrder,
  };
}

function bucket(id: string, players: BoardBucketPlayer[]): BoardBucket {
  return { id, name: id, color: "#808080", sortOrder: 0, players };
}

describe("placeBoardPlayer", () => {
  it("moves a player between tiers and inserts before a target", () => {
    const jokic = player("jokic", "a1", 0);
    const luka = player("luka", "a2", 0);
    const buckets = [
      bucket("S", [jokic]),
      bucket("A", [luka]),
    ];

    const next = placeBoardPlayer(buckets, jokic, "A", "luka");
    expect(next[0]?.players).toEqual([]);
    expect(next[1]?.players.map((item) => item.playerId)).toEqual(["jokic", "luka"]);
  });

  it("appends when no insert target is given", () => {
    const jokic = player("jokic", "a1", 0);
    const luka = player("luka", "a2", 1);
    const buckets = [bucket("S", [jokic, luka])];

    const next = placeBoardPlayer(buckets, jokic, "S");
    expect(next[0]?.players.map((item) => item.playerId)).toEqual(["luka", "jokic"]);
  });
});

describe("removeBoardPlayer", () => {
  it("returns a player to the unassigned pool by dropping them from every tier", () => {
    const jokic = player("jokic", "a1", 0);
    const luka = player("luka", "a2", 1);
    const buckets = [bucket("S", [jokic, luka])];

    const next = removeBoardPlayer(buckets, "jokic");
    expect(next[0]?.players.map((item) => item.playerId)).toEqual(["luka"]);
    expect(next[0]?.players[0]?.sortOrder).toBe(0);
  });
});

describe("moveBoardPlayers", () => {
  it("moves selected players onto the target tier in selection order", () => {
    const jokic = player("jokic", "a1", 0);
    const luka = player("luka", "a2", 0);
    const sga = player("sga", "a3", 1);
    const buckets = [bucket("S", [jokic, sga]), bucket("A", [luka])];

    const next = moveBoardPlayers(buckets, ["sga", "luka"], "S");
    expect(next[0]?.players.map((item) => item.playerId)).toEqual(["jokic", "sga", "luka"]);
    expect(next[1]?.players).toEqual([]);
  });
});

describe("clearBoardPlayers", () => {
  it("empties every tier", () => {
    const buckets = [
      bucket("S", [player("jokic", "a1", 0)]),
      bucket("A", [player("luka", "a2", 0)]),
    ];

    expect(clearBoardPlayers(buckets).map((item) => item.players)).toEqual([[], []]);
  });
});
