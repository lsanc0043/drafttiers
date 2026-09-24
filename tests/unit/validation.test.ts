import { describe, expect, it } from "vitest";
import { isNavItemActive } from "@/lib/nav";
import {
  createBoardSchema,
  createBucketSchema,
  nextAlternatingTierColor,
  playerSearchSchema,
  updateBoardPlayerNotesSchema,
  TIER_COLOR_GRAPHITE,
  TIER_COLOR_GRAY,
} from "@/lib/validation";
import { encodeSseMessage } from "@/lib/realtime/sse";

describe("nav active state", () => {
  it("matches nested board routes", () => {
    expect(isNavItemActive("/boards", "/boards/abc")).toBe(true);
    expect(isNavItemActive("/", "/boards")).toBe(false);
  });
});

describe("validation", () => {
  it("accepts a valid board payload", () => {
    const result = createBoardSchema.parse({ name: "My Board" });
    expect(result.name).toBe("My Board");
    expect(result.visibility).toBe("PRIVATE");
    expect(result.draftSettings).toBeUndefined();
  });

  it("requires every draft setting when provided", () => {
    const scoring = {
      points: 1,
      rebounds: 1,
      assists: 2,
      blocks: 4,
      steals: 4,
      doubleDouble: 2,
      turnover: -2,
      threePointer: 1,
      tripleDouble: 4,
      technical: -2,
      flagrant: -2,
      points40: 0,
      points50: 0,
    };
    expect(
      createBoardSchema.safeParse({
        name: "League",
        draftSettings: {
          teamCount: 12,
          draftPosition: 13,
          roundCount: 13,
          draftType: "SNAKE",
          roundTimerSeconds: 90,
          fantasyScoring: scoring,
        },
      }).success,
    ).toBe(false);
    const result = createBoardSchema.parse({
      name: "League",
      draftSettings: {
        teamCount: 12,
        draftPosition: 5,
        roundCount: 13,
        draftType: "SNAKE",
        roundTimerSeconds: 90,
        fantasyScoring: scoring,
      },
    });
    expect(result.draftSettings?.draftType).toBe("SNAKE");
    expect(result.draftSettings?.draftPosition).toBe(5);
  });

  it("alternates gray and graphite tier colors", () => {
    expect(nextAlternatingTierColor(0)).toBe(TIER_COLOR_GRAY);
    expect(nextAlternatingTierColor(1)).toBe(TIER_COLOR_GRAPHITE);
    expect(nextAlternatingTierColor(2)).toBe(TIER_COLOR_GRAY);
  });

  it("requires a name and hex color for a new tier", () => {
    expect(createBucketSchema.safeParse({ name: "S" }).success).toBe(false);
    expect(createBucketSchema.parse({ name: "S", color: "#ff7f7f" })).toEqual({
      name: "S",
      color: "#ff7f7f",
    });
  });

  it("allows an empty player search", () => {
    const result = playerSearchSchema.safeParse({ query: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a favorite-only board player update", () => {
    expect(updateBoardPlayerNotesSchema.parse({ favorited: true })).toEqual({
      notes: undefined,
      favorited: true,
    });
    expect(updateBoardPlayerNotesSchema.parse({ notes: "  keep  " })).toEqual({
      notes: "keep",
      favorited: undefined,
    });
  });
});

describe("sse helpers", () => {
  it("encodes a draft event", () => {
    const message = encodeSseMessage({
      type: "pick",
      payload: { playerId: "1" },
      occurredAt: "2026-09-12T00:00:00.000Z",
    });

    expect(message).toContain("event: pick");
    expect(message).toContain('"playerId":"1"');
  });
});
