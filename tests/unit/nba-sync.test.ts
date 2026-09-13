import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseNbaCatalog } from "@/lib/nba/python";
import { playerListQuerySchema } from "@/lib/nba/schema";
import { chunk, dedupePlayers, summarizeUpsert } from "@/lib/nba/upsert";
import { resetSyncInFlightForTests, syncNbaPlayers, SyncInProgressError } from "@/lib/nba/sync";
import { listPlayers, teamSearchTerms } from "@/lib/nba/players";
import { isRookieForLeagueYear, leagueStartYear } from "@/lib/nba/season";
import { nbaHeadshotUrl, playerInitials } from "@/lib/nba/headshot";

const lebron = {
  nbaPersonId: 2544,
  firstName: "LeBron",
  lastName: "James",
  fullName: "LeBron James",
  teamId: 1610612747,
  teamAbbr: "LAL",
  teamName: "Los Angeles Lakers",
  position: "F",
  jerseyNumber: "23",
  isActive: true,
};

describe("NBA catalog validation", () => {
  it("accepts a normalized player payload", () => {
    const result = parseNbaCatalog({
      fetched: 1,
      skipped: 0,
      players: [lebron],
    });
    expect(result.fetched).toBe(1);
    expect(result.players[0]?.nbaPersonId).toBe(2544);
  });

  it("counts malformed players as parse failures", () => {
    const result = parseNbaCatalog({
      fetched: 2,
      skipped: 1,
      players: [lebron, { nbaPersonId: "bad" }],
    });
    expect(result.players).toHaveLength(1);
    expect(result.parseFailed).toBe(2);
  });
});

describe("duplicate handling", () => {
  it("keeps the last player for a duplicate NBA id", () => {
    const players = dedupePlayers([
      lebron,
      { ...lebron, teamAbbr: "MIA", isActive: false },
    ]);
    expect(players).toHaveLength(1);
    expect(players[0]?.teamAbbr).toBe("MIA");
  });
});

describe("upsert planning", () => {
  it("counts inserts and updates without duplicating ids", () => {
    const summary = summarizeUpsert(new Set([2544]), [2544, 201566]);
    expect(summary).toEqual({ inserted: 1, updated: 1 });
  });

  it("chunks player batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("player list query validation", () => {
  it("defaults page size and allows empty search", () => {
    const parsed = playerListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
    expect(parsed.query).toBe("");
    expect(parsed.active).toBe("true");
  });

  it("rejects an oversized page", () => {
    expect(playerListQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});

describe("syncNbaPlayers", () => {
  beforeEach(() => {
    resetSyncInFlightForTests();
  });

  it("upserts a catalog and returns counts", async () => {
    const nbaSyncState = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    const player = {
      findMany: vi.fn().mockResolvedValue([{ nbaPersonId: 2544 }]),
    };
    const db = {
      nbaSyncState,
      player,
      $executeRaw: vi.fn().mockResolvedValue(2),
    };

    const result = await syncNbaPlayers({
      prisma: db as never,
      fetchCatalog: async () => ({
        fetched: 2,
        skipped: 0,
        players: [lebron, { ...lebron, nbaPersonId: 201566, fullName: "Russell Westbrook", firstName: "Russell", lastName: "Westbrook" }],
      }),
      now: () => new Date("2026-09-13T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      success: true,
      fetched: 2,
      inserted: 1,
      updated: 1,
      failed: 0,
    });
    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(nbaSyncState.update).toHaveBeenCalled();
  });

  it("does not persist players when python fetch fails", async () => {
    const nbaSyncState = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    const db = {
      nbaSyncState,
      player: { findMany: vi.fn() },
      $executeRaw: vi.fn(),
    };

    await expect(
      syncNbaPlayers({
        prisma: db as never,
        fetchCatalog: async () => {
          throw new Error("stats.nba.com unreachable");
        },
        now: () => new Date("2026-09-13T00:00:00.000Z"),
      }),
    ).rejects.toThrow("stats.nba.com unreachable");

    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(nbaSyncState.upsert).toHaveBeenCalledTimes(2);
  });

  it("rejects overlapping syncs", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const nbaSyncState = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    const db = {
      nbaSyncState,
      player: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    const first = syncNbaPlayers({
      prisma: db as never,
      fetchCatalog: async () => {
        await gate;
        return { fetched: 1, skipped: 0, players: [lebron] };
      },
    });

    await expect(
      syncNbaPlayers({
        prisma: db as never,
        fetchCatalog: async () => ({ fetched: 1, skipped: 0, players: [lebron] }),
      }),
    ).rejects.toBeInstanceOf(SyncInProgressError);

    release();
    await first;
  });
});

describe("listPlayers", () => {
  it("applies search, team, active filters and pagination", async () => {
    const db = {
      player: {
        findMany: vi.fn().mockResolvedValue([lebron]),
        count: vi.fn().mockResolvedValue(42),
      },
    };

    const result = await listPlayers(
      { query: "james", page: 2, pageSize: 10, active: "true", team: "LAL" },
      db as never,
    );

    expect(result.total).toBe(42);
    expect(result.totalPages).toBe(5);
    expect(result.players[0]).toMatchObject({ nbaPersonId: 2544, isRookie: false });
    expect(db.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          isActive: true,
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { fullName: { contains: "james", mode: "insensitive" } },
              ]),
            }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                { teamAbbr: { contains: "LAL", mode: "insensitive" } },
                { teamName: { contains: "LAL", mode: "insensitive" } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("marks 2026-27 first-year players as rookies", async () => {
    const db = {
      player: {
        findMany: vi.fn().mockResolvedValue([{ ...lebron, fromYear: 2026 }]),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    const result = await listPlayers(
      { query: "", page: 1, pageSize: 10, active: "true" },
      db as never,
    );

    expect(result.players[0]?.isRookie).toBe(true);
  });
});

describe("team search terms", () => {
  it("matches city, nickname, and plural nicknames", () => {
    expect(teamSearchTerms("mia")).toEqual(["mia"]);
    expect(teamSearchTerms("Heats")).toEqual(["Heats", "Heat"]);
  });
});

describe("rookie season", () => {
  it("uses July as the league-year rollover", () => {
    expect(leagueStartYear(new Date("2026-06-30T12:00:00"))).toBe(2025);
    expect(leagueStartYear(new Date("2026-09-12T12:00:00"))).toBe(2026);
    expect(isRookieForLeagueYear(2026, new Date("2026-09-12T12:00:00"))).toBe(true);
    expect(isRookieForLeagueYear(2025, new Date("2026-09-12T12:00:00"))).toBe(false);
  });
});

describe("headshots", () => {
  it("builds an NBA CDN url and initials", () => {
    expect(nbaHeadshotUrl(2544)).toContain("/260x190/2544.png");
    expect(playerInitials("LeBron James")).toBe("LJ");
  });
});
