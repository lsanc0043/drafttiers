import { getPlayerEligibleSlots, sleeperPositionLabel } from "@/lib/sleeper/roster/eligibility";
import type { DraftedRosterPlayer } from "@/lib/sleeper/roster/types";

export function getUserPicks<T extends { pickedBy?: string | null }>(
  picks: T[],
  myUserId: string | null | undefined,
) {
  if (!myUserId) {
    return [];
  }
  return picks.filter((pick) => pick.pickedBy === myUserId);
}

export function resolveSleeperUserId(input: {
  typedUserId?: string | null;
  draftSlot?: number | null;
  picks?: Array<{ pickedBy?: string | null; draftSlot?: number | null }>;
}) {
  const typed = input.typedUserId?.trim();
  if (typed) {
    return typed;
  }
  if (input.draftSlot == null) {
    return null;
  }
  return (
    input.picks?.find((pick) => pick.draftSlot === input.draftSlot && pick.pickedBy)?.pickedBy ?? null
  );
}

export function toDraftedRosterPlayers(
  picks: Array<{ pickNo?: number; playerId?: string; label: string; positions: string | string[] | null }>,
): DraftedRosterPlayer[] {
  return picks.map((pick, index) => ({
    id: String(pick.pickNo ?? pick.playerId ?? index),
    label: pick.label,
    eligible: getPlayerEligibleSlots(pick.positions),
    sleeperPosition: sleeperPositionLabel(pick.positions),
  }));
}
