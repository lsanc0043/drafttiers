import { describe, expect, it } from "vitest";
import { matchNbaPersonId } from "@/lib/statdunk/photos";

const directory = [
  { nbaPersonId: 203999, fullName: "Nikola Jokić", teamAbbr: "DEN" },
  { nbaPersonId: 2544, fullName: "LeBron James", teamAbbr: "LAL" },
  { nbaPersonId: 1629029, fullName: "Luka Dončić", teamAbbr: "LAL" },
];

describe("lock-in photo matching", () => {
  it("matches accented StatDunk names to NBA person ids", () => {
    expect(matchNbaPersonId({ playerName: "Nikola Jokic", team: "DEN" }, directory)).toBe(203999);
    expect(matchNbaPersonId({ playerName: "Luka Doncic", team: "LAL" }, directory)).toBe(1629029);
  });

  it("uses team when last names collide", () => {
    const james = [
      { nbaPersonId: 1, fullName: "LeBron James", teamAbbr: "LAL" },
      { nbaPersonId: 2, fullName: "Bronny James", teamAbbr: "LAL" },
    ];
    expect(matchNbaPersonId({ playerName: "LeBron James", team: "LAL" }, james)).toBe(1);
  });
});
