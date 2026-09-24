import { describe, expect, it } from "vitest";
import { teamTagStyle } from "@/lib/nba/team-colors";

describe("team tags", () => {
  it("uses light text on dark team colors", () => {
    expect(teamTagStyle("BKN")?.color).toBe("#F4F4F5");
    expect(teamTagStyle("DEN")?.color).toBe("#F4F4F5");
    expect(teamTagStyle("MIL")?.color).toBe("#F4F4F5");
  });

  it("uses dark text on lighter team colors", () => {
    expect(teamTagStyle("SAS")?.color).toBe("#18181B");
  });
});
