import type { DraftedRosterPlayer, RosterSlotInstance, RosterSlotKey } from "@/lib/sleeper/roster/types";

export function expandRosterSlots(
  counts: Partial<Record<RosterSlotKey, number>>,
  order: RosterSlotKey[],
): RosterSlotInstance[] {
  const slots: RosterSlotInstance[] = [];
  for (const position of order) {
    const required = counts[position] ?? 0;
    for (let index = 0; index < required; index += 1) {
      slots.push({ id: `${position}-${index}`, position });
    }
  }
  return slots;
}

export function calculateRosterAssignment(
  players: DraftedRosterPlayer[],
  slots: RosterSlotInstance[],
): Map<string, RosterSlotInstance> {
  const slotToPlayer = new Map<string, string>();
  const playersById = new Map(players.map((player) => [player.id, player]));

  function augment(playerId: string, seen: Set<string>) {
    const player = playersById.get(playerId);
    if (!player) {
      return false;
    }
    for (const slot of slots) {
      if (!player.eligible.includes(slot.position) || seen.has(slot.id)) {
        continue;
      }
      seen.add(slot.id);
      const occupant = slotToPlayer.get(slot.id);
      if (!occupant || augment(occupant, seen)) {
        slotToPlayer.set(slot.id, playerId);
        return true;
      }
    }
    return false;
  }

  for (const player of players) {
    augment(player.id, new Set());
  }

  const assignment = new Map<string, RosterSlotInstance>();
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  for (const [slotId, playerId] of slotToPlayer) {
    const slot = slotsById.get(slotId);
    if (slot) {
      assignment.set(playerId, slot);
    }
  }
  return assignment;
}

export function matchingSize(players: DraftedRosterPlayer[], slots: RosterSlotInstance[]) {
  return calculateRosterAssignment(players, slots).size;
}
