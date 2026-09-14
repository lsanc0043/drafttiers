import type { BoardBucket, BoardBucketPlayer } from "@/types";

export function placeBoardPlayer(
  buckets: BoardBucket[],
  incoming: BoardBucketPlayer,
  targetBucketId: string,
  beforePlayerId?: string,
): BoardBucket[] {
  return buckets.map((bucket) => {
    const without = bucket.players.filter((player) => player.playerId !== incoming.playerId);
    if (bucket.id !== targetBucketId) {
      return { ...bucket, players: without };
    }

    const next = [...without];
    const insertAt = beforePlayerId
      ? next.findIndex((player) => player.playerId === beforePlayerId)
      : -1;
    if (insertAt === -1) {
      next.push(incoming);
    } else {
      next.splice(insertAt, 0, incoming);
    }

    return {
      ...bucket,
      players: next.map((player, sortOrder) => ({ ...player, sortOrder })),
    };
  });
}

export function removeBoardPlayer(buckets: BoardBucket[], playerId: string): BoardBucket[] {
  return removeBoardPlayers(buckets, [playerId]);
}

export function removeBoardPlayers(buckets: BoardBucket[], playerIds: string[]): BoardBucket[] {
  const selected = new Set(playerIds);
  return buckets.map((bucket) => ({
    ...bucket,
    players: bucket.players
      .filter((player) => !selected.has(player.playerId))
      .map((player, sortOrder) => ({ ...player, sortOrder })),
  }));
}

export function moveBoardPlayers(
  buckets: BoardBucket[],
  playerIds: string[],
  targetBucketId: string,
): BoardBucket[] {
  const selected = new Set(playerIds);
  const moving: BoardBucketPlayer[] = [];
  for (const playerId of playerIds) {
    for (const bucket of buckets) {
      const match = bucket.players.find((player) => player.playerId === playerId);
      if (match) {
        moving.push(match);
        break;
      }
    }
  }

  return buckets.map((bucket) => {
    const remaining = bucket.players.filter((player) => !selected.has(player.playerId));
    const next = bucket.id === targetBucketId ? [...remaining, ...moving] : remaining;
    return {
      ...bucket,
      players: next.map((player, sortOrder) => ({ ...player, sortOrder })),
    };
  });
}

export function clearBoardPlayers(buckets: BoardBucket[]): BoardBucket[] {
  return buckets.map((bucket) => ({ ...bucket, players: [] }));
}
