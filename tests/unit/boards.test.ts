import { describe, expect, it, vi } from "vitest";
import {
  addBucket,
  assignPlayerToBucket,
  bulkUpdateBoardPlayers,
  clearBoardPlayers,
  createBoard,
  deleteBoard,
  deleteBucket,
  unassignPlayerFromBoard,
} from "@/lib/boards";

function makeDb() {
  const now = new Date("2026-09-13T00:00:00.000Z");
  return {
    board: {
      create: vi.fn().mockResolvedValue({
        id: "board-1",
        name: "Untitled board",
        visibility: "PRIVATE",
        createdAt: now,
        updatedAt: now,
      }),
      findUnique: vi.fn().mockResolvedValue({ id: "board-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ maxOrder: 0 }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("boards", () => {
  it("creates a board without default tiers", async () => {
    const db = makeDb();
    const board = await createBoard({ name: "Untitled board", visibility: "PRIVATE" }, db as never);
    expect(board.id).toBe("board-1");
    expect(board.buckets).toEqual([]);
    expect(board.draftSettings).toBeNull();
  });

  it("creates a board with draft settings", async () => {
    const db = makeDb();
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
    db.board.create.mockResolvedValue({
      id: "board-1",
      name: "Untitled board",
      visibility: "PRIVATE",
      teamCount: 12,
      draftPosition: 4,
      roundCount: 13,
      draftType: "SNAKE",
      roundTimerSeconds: 90,
      fantasyScoring: scoring,
      createdAt: new Date("2026-09-13T00:00:00.000Z"),
      updatedAt: new Date("2026-09-13T00:00:00.000Z"),
    });
    const board = await createBoard(
      {
        name: "Untitled board",
        visibility: "PRIVATE",
        draftSettings: {
          teamCount: 12,
          draftPosition: 4,
          roundCount: 13,
          draftType: "SNAKE",
          roundTimerSeconds: 90,
          fantasyScoring: scoring,
        },
      },
      db as never,
    );
    expect(board.draftSettings?.teamCount).toBe(12);
    expect(board.draftSettings?.draftType).toBe("SNAKE");
  });

  it("deletes a board", async () => {
    const db = {
      board: {
        findUnique: vi.fn().mockResolvedValue({ id: "board-1" }),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    expect(await deleteBoard("board-1", db as never)).toBe(true);
    expect(db.board.delete).toHaveBeenCalledWith({ where: { id: "board-1" } });
  });

  it("adds and deletes a tier on a board", async () => {
    const db = makeDb();
    const bucket = await addBucket("board-1", { name: "S", color: "#ff7f7f" }, db as never);
    expect(bucket?.name).toBe("S");
    expect(bucket?.color).toBe("#ff7f7f");
    expect(bucket?.players).toEqual([]);
    expect(await deleteBucket("board-1", bucket?.id ?? "tier-1", db as never)).toBe(true);
    expect(db.$executeRaw).toHaveBeenCalled();
  });

  it("assigns a player to a tier", async () => {
    const db = {
      board: {
        findUnique: vi.fn().mockResolvedValue({ id: "board-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
      bucket: {
        findFirst: vi.fn().mockResolvedValue({ id: "bucket-1", boardId: "board-1" }),
      },
      player: {
        findUnique: vi.fn().mockResolvedValue({
          id: "player-1",
          nbaPersonId: 2544,
          fullName: "LeBron James",
          teamAbbr: "LAL",
          teamName: "Lakers",
          position: "F",
          jerseyNumber: "23",
          isActive: true,
        }),
      },
      boardPlayer: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({
          id: "assign-1",
          bucketId: "bucket-1",
          playerId: "player-1",
          sortOrder: 0,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await assignPlayerToBucket(
      "board-1",
      { playerId: "player-1", bucketId: "bucket-1" },
      db as never,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bucketId).toBe("bucket-1");
      expect(result.player.fullName).toBe("LeBron James");
    }
    expect(db.boardPlayer.upsert).toHaveBeenCalled();
    expect(db.boardPlayer.update).not.toHaveBeenCalled();
  });

  it("unassigns a player from a board", async () => {
    const db = {
      board: {
        update: vi.fn().mockResolvedValue({}),
      },
      boardPlayer: {
        findUnique: vi.fn().mockResolvedValue({ id: "assign-1", bucketId: "bucket-1" }),
        delete: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([{ playerId: "player-2" }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    expect(await unassignPlayerFromBoard("board-1", "player-1", db as never)).toBe(true);
    expect(db.boardPlayer.delete).toHaveBeenCalledWith({ where: { id: "assign-1" } });
    expect(db.boardPlayer.update).toHaveBeenCalledWith({
      where: { boardId_playerId: { boardId: "board-1", playerId: "player-2" } },
      data: { sortOrder: 0 },
    });
  });

  it("clears every assigned player from a board", async () => {
    const db = {
      board: {
        findUnique: vi.fn().mockResolvedValue({ id: "board-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
      boardPlayer: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    expect(await clearBoardPlayers("board-1", db as never)).toBe(true);
    expect(db.boardPlayer.deleteMany).toHaveBeenCalledWith({ where: { boardId: "board-1" } });
  });

  it("unassigns selected players in bulk", async () => {
    const db = {
      board: {
        findUnique: vi.fn().mockResolvedValue({ id: "board-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
      boardPlayer: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([{ bucketId: "bucket-1", playerId: "player-3" }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await bulkUpdateBoardPlayers(
      "board-1",
      { action: "unassign", playerIds: ["player-1", "player-2"] },
      db as never,
    );

    expect(result.ok).toBe(true);
    expect(db.boardPlayer.deleteMany).toHaveBeenCalledWith({
      where: { boardId: "board-1", playerId: { in: ["player-1", "player-2"] } },
    });
  });

  it("moves selected players onto a tier", async () => {
    const db = {
      board: {
        findUnique: vi.fn().mockResolvedValue({ id: "board-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
      bucket: {
        findFirst: vi.fn().mockResolvedValue({ id: "bucket-2" }),
      },
      boardPlayer: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ playerId: "player-1" }])
          .mockResolvedValueOnce([
            { bucketId: "bucket-1", playerId: "player-1" },
            { bucketId: "bucket-2", playerId: "player-2" },
          ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await bulkUpdateBoardPlayers(
      "board-1",
      { action: "move", playerIds: ["player-1"], bucketId: "bucket-2" },
      db as never,
    );

    expect(result.ok).toBe(true);
    expect(db.boardPlayer.update).toHaveBeenCalledWith({
      where: { boardId_playerId: { boardId: "board-1", playerId: "player-2" } },
      data: { bucketId: "bucket-2", sortOrder: 0 },
    });
    expect(db.boardPlayer.update).toHaveBeenCalledWith({
      where: { boardId_playerId: { boardId: "board-1", playerId: "player-1" } },
      data: { bucketId: "bucket-2", sortOrder: 1 },
    });
  });
});
