import { describe, expect, it } from "vitest";
import { moveBucketRelative, reorderBoardBuckets } from "@/lib/board-buckets";
import type { BoardBucket } from "@/types";

function bucket(id: string, sortOrder: number): BoardBucket {
  return {
    id,
    name: id,
    color: "#808080",
    sortOrder,
    groups: [],
    players: [],
  };
}

describe("reorderBoardBuckets", () => {
  it("moves a tier before another and rewrites sortOrder", () => {
    const buckets = [bucket("S", 0), bucket("A", 1), bucket("B", 2)];
    const next = moveBucketRelative(buckets, "B", "S", "before");
    expect(next.map((item) => item.id)).toEqual(["B", "S", "A"]);
    expect(next.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
  });

  it("keeps unknown leftover tiers after the requested order", () => {
    const next = reorderBoardBuckets(
      [bucket("S", 0), bucket("A", 1), bucket("B", 2)],
      ["A", "S"],
    );
    expect(next.map((item) => item.id)).toEqual(["A", "S", "B"]);
  });
});
