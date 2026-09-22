import type { DraftDiff, DraftPick } from "@/lib/sleeper/tracker/types";

function pickKey(pick: DraftPick) {
  return pick.pickNo;
}

function importantFields(pick: DraftPick) {
  return JSON.stringify({
    playerId: pick.playerId,
    pickedBy: pick.pickedBy ?? null,
    isKeeper: pick.isKeeper ?? null,
  });
}

export function diffDraftPicks(previousPicks: DraftPick[], currentPicks: DraftPick[]): DraftDiff {
  const previousByNo = new Map(previousPicks.map((pick) => [pickKey(pick), pick]));
  const currentByNo = new Map(currentPicks.map((pick) => [pickKey(pick), pick]));

  const added: DraftPick[] = [];
  const removed: DraftPick[] = [];
  const changed: DraftDiff["changed"] = [];

  for (const pick of currentPicks) {
    const previous = previousByNo.get(pickKey(pick));
    if (!previous) {
      added.push(pick);
      continue;
    }
    if (importantFields(previous) !== importantFields(pick)) {
      changed.push({ previous, current: pick });
    }
  }

  for (const pick of previousPicks) {
    if (!currentByNo.has(pickKey(pick))) {
      removed.push(pick);
    }
  }

  added.sort((left, right) => left.pickNo - right.pickNo);
  removed.sort((left, right) => left.pickNo - right.pickNo);
  changed.sort((left, right) => left.current.pickNo - right.current.pickNo);

  return { added, removed, changed };
}
