import { describe, expect, it } from "vitest";
import { isNavItemActive } from "@/lib/nav";
import { createBoardSchema, playerSearchSchema } from "@/lib/validation";
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
  });

  it("rejects an empty player search", () => {
    const result = playerSearchSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
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
