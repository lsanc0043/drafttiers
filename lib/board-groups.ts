import type { BoardBucket, BoardBucketGroup } from "@/types";

export const GROUP_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

export function nextGroupColor(existingCount: number) {
  return GROUP_COLORS[existingCount % GROUP_COLORS.length] ?? GROUP_COLORS[0]!;
}

export function parseBucketGroups(value: unknown): BoardBucketGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const groups: BoardBucketGroup[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const color = typeof row.color === "string" ? row.color : "#3b82f6";
    const playerIds = Array.isArray(row.playerIds)
      ? row.playerIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    if (!id || !name) {
      continue;
    }
    groups.push({ id, name, color, playerIds: [...new Set(playerIds)] });
  }
  return groups;
}

export function groupedPlayerIdSet(groups: BoardBucketGroup[]) {
  return new Set(groups.flatMap((group) => group.playerIds));
}

export function uniqueBoardGroups(buckets: BoardBucket[]): BoardBucketGroup[] {
  const seen = new Map<string, BoardBucketGroup>();
  for (const bucket of buckets) {
    for (const group of bucket.groups) {
      const existing = seen.get(group.id);
      if (!existing) {
        seen.set(group.id, { ...group, playerIds: [...group.playerIds] });
        continue;
      }
      seen.set(group.id, {
        ...existing,
        name: group.name,
        color: group.color,
        playerIds: [...new Set([...existing.playerIds, ...group.playerIds])],
      });
    }
  }
  return [...seen.values()];
}

export function syncGroupShells(buckets: BoardBucket[]): BoardBucket[] {
  const templates = uniqueBoardGroups(buckets);
  if (templates.length === 0) {
    return buckets;
  }
  return buckets.map((bucket) => {
    const byId = new Map(bucket.groups.map((group) => [group.id, group]));
    return {
      ...bucket,
      groups: templates.map(
        (template) => byId.get(template.id) ?? { ...template, playerIds: [] },
      ),
    };
  });
}

export function findPlayerGroup(buckets: BoardBucket[], playerId: string) {
  for (const bucket of buckets) {
    const group = bucket.groups.find((item) => item.playerIds.includes(playerId));
    if (group) {
      return { bucketId: bucket.id, group };
    }
  }
  return null;
}

function withoutPlayer(groups: BoardBucketGroup[], playerId: string): BoardBucketGroup[] {
  return groups.map((group) => ({
    ...group,
    playerIds: group.playerIds.filter((id) => id !== playerId),
  }));
}

export function setPlayerGroup(
  buckets: BoardBucket[],
  playerId: string,
  targetBucketId: string,
  groupId: string | null,
): BoardBucket[] {
  const template = groupId
    ? uniqueBoardGroups(buckets).find((group) => group.id === groupId)
    : undefined;
  return buckets.map((bucket) => {
    const stripped = withoutPlayer(bucket.groups, playerId);
    if (bucket.id !== targetBucketId || !groupId) {
      return { ...bucket, groups: stripped };
    }
    const hasGroup = stripped.some((group) => group.id === groupId);
    const groups =
      hasGroup || !template
        ? stripped
        : [...stripped, { ...template, playerIds: [] }];
    return {
      ...bucket,
      groups: groups.map((group) =>
        group.id === groupId && !group.playerIds.includes(playerId)
          ? { ...group, playerIds: [...group.playerIds, playerId] }
          : group,
      ),
    };
  });
}

export function addBoardGroup(buckets: BoardBucket[], group: BoardBucketGroup): BoardBucket[] {
  const memberIds = new Set(group.playerIds);
  const ownerByPlayer = new Map<string, string>();
  for (const bucket of buckets) {
    for (const player of bucket.players) {
      if (memberIds.has(player.playerId)) {
        ownerByPlayer.set(player.playerId, bucket.id);
      }
    }
  }
  return syncGroupShells(
    buckets.map((bucket) => {
      const stripped = bucket.groups
        .filter((item) => item.id !== group.id)
        .map((item) => ({
          ...item,
          playerIds: item.playerIds.filter((id) => !memberIds.has(id)),
        }));
      const playerIds = group.playerIds.filter((id) => ownerByPlayer.get(id) === bucket.id);
      return { ...bucket, groups: [...stripped, { ...group, playerIds }] };
    }),
  );
}

export function addBucketGroup(
  buckets: BoardBucket[],
  _bucketId: string,
  group: BoardBucketGroup,
): BoardBucket[] {
  return addBoardGroup(buckets, group);
}

export function updateBucketGroup(
  buckets: BoardBucket[],
  groupId: string,
  patch: { name?: string; color?: string },
): BoardBucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    groups: bucket.groups.map((group) =>
      group.id === groupId ? { ...group, ...patch } : group,
    ),
  }));
}

export function deleteBucketGroup(buckets: BoardBucket[], groupId: string): BoardBucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    groups: bucket.groups.filter((group) => group.id !== groupId),
  }));
}

export function clearGroupPlayerIds(buckets: BoardBucket[]): BoardBucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    groups: bucket.groups.map((group) => ({ ...group, playerIds: [] })),
  }));
}
