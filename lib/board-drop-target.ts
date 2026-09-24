export type PlayerDropDest = {
  bucketId: string;
  groupId: string | null;
  relativePlayerId?: string;
  side?: "before" | "after";
};

export type TierDropDest = {
  targetId: string;
  side: "before" | "after";
};

export function resolvePlayerDropDest(
  x: number,
  y: number,
  sourcePlayerId?: string,
): PlayerDropDest | null {
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof Element) || node.closest("[data-drop-ignore]")) {
      continue;
    }

    const chip = node.closest("[data-drop-chip]");
    if (chip instanceof HTMLElement) {
      const bucketId = chip.dataset.dropBucket;
      const chipId = chip.dataset.dropChip;
      if (bucketId && chipId && chipId !== sourcePlayerId) {
        const box = chip.getBoundingClientRect();
        return {
          bucketId,
          groupId: chip.dataset.dropGroup || null,
          relativePlayerId: chipId,
          side: x < box.left + box.width / 2 ? "before" : "after",
        };
      }
    }

    const group = node.closest("[data-drop-group]");
    if (group instanceof HTMLElement) {
      const bucketId = group.dataset.dropBucket;
      const groupId = group.dataset.dropGroup;
      if (bucketId && groupId) {
        return { bucketId, groupId };
      }
    }

    const bucket = node.closest("[data-drop-bucket]");
    if (bucket instanceof HTMLElement && bucket.dataset.dropBucket) {
      return { bucketId: bucket.dataset.dropBucket, groupId: null };
    }
  }

  return null;
}

export function resolveTierDropDest(x: number, y: number, sourceId: string): TierDropDest | null {
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof Element) || node.closest("[data-drop-ignore]")) {
      continue;
    }
    const tier = node.closest("[data-tier-id]");
    if (!(tier instanceof HTMLElement) || !tier.dataset.tierId || tier.dataset.tierId === sourceId) {
      continue;
    }
    const box = tier.getBoundingClientRect();
    return {
      targetId: tier.dataset.tierId,
      side: y < box.top + box.height / 2 ? "before" : "after",
    };
  }
  return null;
}
