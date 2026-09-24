import type { BoardBucket, BoardBucketPlayer } from "@/types";
import { clearGroupPlayerIds, setPlayerGroup } from "@/lib/board-groups";

export function placeBoardPlayer(
  buckets: BoardBucket[],
  incoming: BoardBucketPlayer,
  targetBucketId: string,
  beforePlayerId?: string,
  groupId?: string | null,
): BoardBucket[] {
  const placed = buckets.map((bucket) => {
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
  return setPlayerGroup(placed, incoming.playerId, targetBucketId, groupId ?? null);
}

export function removeBoardPlayer(buckets: BoardBucket[], playerId: string): BoardBucket[] {
  return removeBoardPlayers(buckets, [playerId]);
}

export function removeBoardPlayers(buckets: BoardBucket[], playerIds: string[]): BoardBucket[] {
  const selected = new Set(playerIds);
  return buckets.map((bucket) => ({
    ...bucket,
    groups: bucket.groups.map((group) => ({
      ...group,
      playerIds: group.playerIds.filter((id) => !selected.has(id)),
    })),
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

  const moved = buckets.map((bucket) => {
    const remaining = bucket.players.filter((player) => !selected.has(player.playerId));
    const next = bucket.id === targetBucketId ? [...remaining, ...moving] : remaining;
    return {
      ...bucket,
      players: next.map((player, sortOrder) => ({ ...player, sortOrder })),
    };
  });
  return playerIds.reduce(
    (current, playerId) => setPlayerGroup(current, playerId, targetBucketId, null),
    moved,
  );
}

export function setBoardPlayerNotes(
  buckets: BoardBucket[],
  playerId: string,
  notes: string | null,
): BoardBucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    players: bucket.players.map((player) =>
      player.playerId === playerId ? { ...player, notes } : player,
    ),
  }));
}

export function setBoardPlayerFavorited(
  buckets: BoardBucket[],
  playerId: string,
  favorited: boolean,
): BoardBucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    players: bucket.players.map((player) =>
      player.playerId === playerId ? { ...player, favorited } : player,
    ),
  }));
}

export function clearBoardFavoritesLocal(buckets: BoardBucket[]): BoardBucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    players: bucket.players.map((player) => ({ ...player, favorited: false })),
  }));
}

export function clearBoardPlayers(buckets: BoardBucket[]): BoardBucket[] {
  return clearGroupPlayerIds(buckets).map((bucket) => ({ ...bucket, players: [] }));
}
