import type { BoardBucket } from "@/types";

export function reorderBoardBuckets(buckets: BoardBucket[], orderedIds: string[]): BoardBucket[] {
  const byId = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  const seen = new Set<string>();
  const next: BoardBucket[] = [];
  for (const id of orderedIds) {
    const bucket = byId.get(id);
    if (!bucket || seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(bucket);
  }
  for (const bucket of buckets) {
    if (!seen.has(bucket.id)) {
      next.push(bucket);
    }
  }
  return next.map((bucket, sortOrder) => ({ ...bucket, sortOrder }));
}

export function moveBucketRelative(
  buckets: BoardBucket[],
  draggedId: string,
  targetId: string,
  side: "before" | "after",
): BoardBucket[] {
  if (draggedId === targetId) {
    return buckets;
  }
  const ids = buckets.map((bucket) => bucket.id);
  if (!ids.includes(draggedId) || !ids.includes(targetId)) {
    return buckets;
  }
  const without = ids.filter((id) => id !== draggedId);
  const targetIndex = without.indexOf(targetId);
  without.splice(side === "before" ? targetIndex : targetIndex + 1, 0, draggedId);
  return reorderBoardBuckets(buckets, without);
}
