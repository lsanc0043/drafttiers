import { describe, expect, it } from "vitest";
import { parseSleeperDraftUrl, parseSleeperId } from "@/lib/sleeper/ids";
import {
  draftSlotForPickNo,
  matchPickedPlayerIds,
  matchUserDraftedPlayerIds,
  parseDraftPosition,
} from "@/lib/sleeper/picks";
import {
  mapSleeperDraftSettings,
  mapSleeperDraftType,
  mapSleeperScoring,
} from "@/lib/sleeper/settings";
import { DEFAULT_FANTASY_SCORING } from "@/lib/nba/fantasy";

describe("parseSleeperId", () => {
  it("accepts a raw snowflake", () => {
    expect(parseSleeperId(" 257270643320426496 ")).toBe("257270643320426496");
  });

  it("extracts an id from a draft URL", () => {
    expect(parseSleeperId("https://sleeper.com/draft/nba/257270643320426496")).toBe(
      "257270643320426496",
    );
  });

  it("extracts an id from a league URL", () => {
    expect(parseSleeperId("https://sleeper.app/leagues/257270637750382592")).toBe(
      "257270637750382592",
    );
  });

  it("requires a full Sleeper draft URL for mock drafts", () => {
    expect(parseSleeperDraftUrl("1280302406235602944")).toBeNull();
    expect(parseSleeperDraftUrl("https://example.com/draft/nba/1280302406235602944")).toBeNull();
    expect(parseSleeperDraftUrl("https://sleeper.com/leagues/1280302406235602944")).toBeNull();
    expect(parseSleeperDraftUrl("https://sleeper.com/draft/nba/1280302406235602944")).toBe(
      "1280302406235602944",
    );
  });
});

describe("sleeper mapping", () => {
  it("maps snake drafts and NBA scoring keys", () => {
    expect(mapSleeperDraftType("snake")).toBe("SNAKE");
    expect(mapSleeperDraftType("auction")).toBe("CUSTOM");

    const scoring = mapSleeperScoring({
      pts: 1,
      reb: 1.2,
      ast: 1.5,
      stl: 3,
      blk: 3,
      tov: -1,
      fg3m: 0.5,
      dd: 5,
      td: 10,
      tf: -1,
      ff: -2,
      pts_40: 3,
      pts_50: 5,
    });

    expect(scoring).toMatchObject({
      points: 1,
      rebounds: 1.2,
      assists: 1.5,
      steals: 3,
      blocks: 3,
      turnover: -1,
      threePointer: 0.5,
      doubleDouble: 5,
      tripleDouble: 10,
      technical: -1,
      flagrant: -2,
      points40: 3,
      points50: 5,
    });
  });

  it("matches Sleeper picks to board players by name", () => {
    const picked = matchPickedPlayerIds(
      [
        {
          pick_no: 1,
          metadata: { first_name: "Nikola", last_name: "Jokić" },
        },
        {
          pick_no: 2,
          metadata: { first_name: "Shai", last_name: "Gilgeous-Alexander" },
        },
      ],
      [
        { playerId: "jokic", fullName: "Nikola Jokic" },
        { playerId: "shai", fullName: "Shai Gilgeous-Alexander" },
        { playerId: "luka", fullName: "Luka Doncic" },
      ],
    );
    expect([...picked].sort()).toEqual(["jokic", "shai"]);
  });

  it("requires a valid draft position", () => {
    expect(parseDraftPosition("")).toBeNull();
    expect(parseDraftPosition("0")).toBeNull();
    expect(parseDraftPosition("3", 2)).toBeNull();
    expect(parseDraftPosition("4", 12)).toBe(4);
  });

  it("computes snake and linear draft slots", () => {
    expect(draftSlotForPickNo(1, 12, "SNAKE")).toBe(1);
    expect(draftSlotForPickNo(12, 12, "SNAKE")).toBe(12);
    expect(draftSlotForPickNo(13, 12, "SNAKE")).toBe(12);
    expect(draftSlotForPickNo(24, 12, "SNAKE")).toBe(1);
    expect(draftSlotForPickNo(13, 12, "LINEAR")).toBe(1);
  });

  it("matches only the user's drafted players", () => {
    const mine = matchUserDraftedPlayerIds(
      [
        { pick_no: 1, draft_slot: 1, metadata: { first_name: "Nikola", last_name: "Jokic" } },
        { pick_no: 2, draft_slot: 2, metadata: { first_name: "Shai", last_name: "Gilgeous-Alexander" } },
        { pick_no: 24, metadata: { first_name: "Luka", last_name: "Doncic" } },
      ],
      [
        { playerId: "jokic", fullName: "Nikola Jokic" },
        { playerId: "shai", fullName: "Shai Gilgeous-Alexander" },
        { playerId: "luka", fullName: "Luka Doncic" },
      ],
      1,
      12,
      "SNAKE",
    );
    expect([...mine].sort()).toEqual(["jokic", "luka"]);
  });

  it("fills draft settings from a draft and league", () => {
    const settings = mapSleeperDraftSettings(
      {
        type: "linear",
        settings: { teams: 10, rounds: 14, pick_timer: 60 },
      },
      {
        total_rosters: 12,
        scoring_settings: { pts: 2, reb: 1 },
      },
    );

    expect(settings.teamCount).toBe(10);
    expect(settings.roundCount).toBe(14);
    expect(settings.roundTimerSeconds).toBe(60);
    expect(settings.draftType).toBe("LINEAR");
    expect(settings.draftPosition).toBe(1);
    expect(settings.fantasyScoring.points).toBe(2);
    expect(settings.fantasyScoring.assists).toBe(DEFAULT_FANTASY_SCORING.assists);
  });
});
