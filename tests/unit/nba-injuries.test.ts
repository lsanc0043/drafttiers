import { describe, expect, it } from "vitest";
import {
  canonicalTeamAbbr,
  espnTeamInjuriesUrl,
  getPlayerInjury,
  injuryStatusLabel,
  isInjuredStatus,
  isPlayerInjured,
  normalizePlayerName,
  parseEspnInjuries,
} from "@/lib/nba/injuries";

describe("injury matching", () => {
  it("normalizes suffixes and accents", () => {
    expect(normalizePlayerName("Jimmy Butler III")).toBe("jimmy butler");
    expect(normalizePlayerName("Nikola Jokić")).toBe("nikola jokic");
    expect(normalizePlayerName("Darius Acuff Jr.")).toBe("darius acuff");
  });

  it("maps ESPN team abbreviations onto NBA ones", () => {
    expect(canonicalTeamAbbr("GS")).toBe("GSW");
    expect(canonicalTeamAbbr("lal")).toBe("LAL");
  });

  it("maps ESPN status to GTD or OUT", () => {
    expect(isInjuredStatus("Out")).toBe(true);
    expect(isInjuredStatus("Day-To-Day")).toBe(true);
    expect(isInjuredStatus("Probable")).toBe(false);
    expect(injuryStatusLabel("Out")).toBe("OUT");
    expect(injuryStatusLabel("Injured Reserve")).toBe("OUT");
    expect(injuryStatusLabel("Day-To-Day")).toBe("GTD");
    expect(injuryStatusLabel("Questionable")).toBe("GTD");
  });

  it("builds the ESPN team injury log URL", () => {
    expect(
      espnTeamInjuriesUrl({ abbreviation: "MIA", slug: "miami-heat" }),
    ).toBe("https://www.espn.com/nba/team/injuries/_/name/mia/miami-heat");
  });

  it("matches ESPN injury rows to catalog players", () => {
    const index = parseEspnInjuries({
      injuries: [
        {
          displayName: "Golden State Warriors",
          injuries: [
            {
              status: "Out",
              athlete: {
                displayName: "Jimmy Butler III",
                team: { abbreviation: "GS", slug: "golden-state-warriors" },
              },
            },
            {
              status: "Probable",
              athlete: {
                displayName: "Stephen Curry",
                team: { abbreviation: "GS" },
              },
            },
          ],
        },
      ],
    });

    expect(
      isPlayerInjured({ fullName: "Jimmy Butler", teamAbbr: "GSW" }, index),
    ).toBe(true);
    expect(
      isPlayerInjured({ fullName: "Stephen Curry", teamAbbr: "GSW" }, index),
    ).toBe(false);
    expect(
      getPlayerInjury({ fullName: "Jimmy Butler", teamAbbr: "GSW" }, index)?.url,
    ).toBe("https://www.espn.com/nba/team/injuries/_/name/gs/golden-state-warriors");
    expect(
      getPlayerInjury({ fullName: "Jimmy Butler", teamAbbr: "GSW" }, index)?.label,
    ).toBe("OUT");
    expect(
      isPlayerInjured({ fullName: "Jimmy Butler", teamAbbr: "MIA" }, index),
    ).toBe(false);
  });
});
