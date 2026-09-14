import { describe, expect, it } from "vitest";
import { usageRate, usageRateFromPerGame } from "@/lib/nba/usage";

const team = {
  fieldGoalsAttempted: 50,
  freeThrowsAttempted: 0,
  turnovers: 0,
  minutes: 240,
};

const player = {
  fieldGoalsAttempted: 10,
  freeThrowsAttempted: 0,
  turnovers: 0,
  minutes: 24,
};

describe("usage rate", () => {
  it("uses the standard USG% formula", () => {
    expect(usageRate(player, team, 16)).toBe(40);
  });

  it("is omitted when the player has 15 or fewer games", () => {
    expect(usageRate(player, team, 15)).toBeNull();
    expect(usageRate(player, team, 8)).toBeNull();
  });

  it("converts per-game averages into season totals", () => {
    expect(
      usageRateFromPerGame(
        {
          fieldGoalsAttempted: 10,
          freeThrowsAttempted: 0,
          turnovers: 0,
          minutes: 24,
        },
        {
          fieldGoalsAttempted: 50 * 16,
          freeThrowsAttempted: 0,
          turnovers: 0,
          minutes: 240 * 16,
        },
        16,
      ),
    ).toBe(40);
  });
});
