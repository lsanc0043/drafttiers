import { describe, expect, it } from "vitest";
import { parseSleeperNews } from "@/lib/sleeper/news";

describe("sleeper news", () => {
  it("parses rotowire metadata payloads", () => {
    const news = parseSleeperNews([
      {
        metadata: {
          title: "Nikola Jokic - Modest line in win",
          description: "Jokic recorded six points.",
          analysis: "He impacted the game as a rebounder.",
        },
        source: "rotowire",
        player_id: "1658",
        published: 1788189971000,
      },
    ]);

    expect(news).toHaveLength(1);
    expect(news[0]?.title).toBe("Nikola Jokic - Modest line in win");
    expect(news[0]?.source).toBe("rotowire");
    expect(news[0]?.playerId).toBe("1658");
    expect(news[0]?.publishedAt).toBe("2026-08-31T15:26:11.000Z");
  });
});
