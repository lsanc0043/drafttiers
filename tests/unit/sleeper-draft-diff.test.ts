import { describe, expect, it } from "vitest";
import { diffDraftPicks } from "@/lib/sleeper/tracker/diff";
import { parseGraphqlDraft } from "@/lib/sleeper/tracker/parser";
import { buildGetDraftQuery } from "@/lib/sleeper/tracker/graphql";
import type { DraftPick } from "@/lib/sleeper/tracker/types";
import { parseSleeperNbaDraftUrl } from "@/lib/sleeper/ids";

function pick(pickNo: number, playerId: string, pickedBy = "team1"): DraftPick {
  return { pickNo, playerId, pickedBy, draftSlot: null, round: null };
}

describe("parseSleeperNbaDraftUrl", () => {
  it("requires a full NBA draft URL", () => {
    expect(parseSleeperNbaDraftUrl("1405353429185925120")).toBeNull();
    expect(parseSleeperNbaDraftUrl("https://sleeper.com/draft/nfl/1405353429185925120")).toBeNull();
    expect(parseSleeperNbaDraftUrl("https://sleeper.com/draft/nba/1405353429185925120")).toBe(
      "1405353429185925120",
    );
  });
});

describe("buildGetDraftQuery", () => {
  it("inlines a numeric draft id and the get_draft operation", () => {
    const query = buildGetDraftQuery("1405353429185925120");
    expect(query).toContain("query get_draft");
    expect(query).toContain('draft_id: "1405353429185925120"');
    expect(query).toContain("draft_picks");
    expect(query).not.toContain("draft_slot");
    expect(() => buildGetDraftQuery("abc")).toThrow();
  });
});

describe("parseGraphqlDraft", () => {
  it("normalizes a mocked GraphQL payload", () => {
    const snapshot = parseGraphqlDraft(
      {
        data: {
          get_draft: {
            draft_id: "9",
            status: "in_progress",
            type: "snake",
            settings: { teams: 2 },
          },
          draft_picks: [
            { pick_no: 2, player_id: "200", picked_by: "u2", metadata: { first_name: "Luka" } },
            { pick_no: 1, player_id: "100", picked_by: "u1" },
          ],
        },
      },
      "9",
    );
    expect(snapshot.status).toBe("in_progress");
    expect(snapshot.picks.map((item) => item.pickNo)).toEqual([1, 2]);
    expect(snapshot.picks[0]?.draftSlot).toBe(1);
    expect(snapshot.picks[1]?.draftSlot).toBe(2);
  });
});

describe("diffDraftPicks", () => {
  it("detects the first pick from an empty snapshot", () => {
    const diff = diffDraftPicks([], [pick(1, "100")]);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it("detects one new pick", () => {
    const previous = [pick(1, "100")];
    const current = [pick(1, "100"), pick(2, "200", "team2")];
    expect(diffDraftPicks(previous, current).added).toHaveLength(1);
    expect(diffDraftPicks(previous, current).added[0]?.pickNo).toBe(2);
  });

  it("detects multiple new picks", () => {
    const diff = diffDraftPicks([pick(1, "1"), pick(2, "2")], [
      pick(1, "1"),
      pick(2, "2"),
      pick(3, "3"),
      pick(4, "4"),
    ]);
    expect(diff.added.map((item) => item.pickNo)).toEqual([3, 4]);
  });

  it("reports no changes for identical snapshots", () => {
    const picks = [pick(1, "100"), pick(2, "200")];
    expect(diffDraftPicks(picks, picks)).toEqual({ added: [], removed: [], changed: [] });
  });

  it("reports a removed pick", () => {
    const diff = diffDraftPicks([pick(1, "100"), pick(2, "200")], [pick(1, "100")]);
    expect(diff.removed.map((item) => item.pickNo)).toEqual([2]);
  });

  it("reports a changed pick", () => {
    const diff = diffDraftPicks([pick(1, "100")], [pick(1, "999")]);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.current.playerId).toBe("999");
  });

  it("detects a pick that arrived out of order", () => {
    const diff = diffDraftPicks([pick(1, "1"), pick(3, "3")], [pick(1, "1"), pick(2, "2"), pick(3, "3")]);
    expect(diff.added.map((item) => item.pickNo)).toEqual([2]);
  });

  it("treats duplicate snapshots as unchanged", () => {
    const previous = [pick(1, "100"), pick(2, "200")];
    const current = [pick(1, "100"), pick(2, "200")];
    expect(diffDraftPicks(previous, current).added).toHaveLength(0);
  });

  it("handles two empty snapshots", () => {
    expect(diffDraftPicks([], [])).toEqual({ added: [], removed: [], changed: [] });
  });

  it("diffs a large snapshot", () => {
    const previous = Array.from({ length: 180 }, (_, index) => pick(index + 1, String(index + 1)));
    const current = [...previous, pick(181, "181"), pick(182, "182")];
    expect(diffDraftPicks(previous, current).added.map((item) => item.pickNo)).toEqual([181, 182]);
  });
});
