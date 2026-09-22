import { calculateRosterAssignment, expandRosterSlots, matchingSize } from "@/lib/sleeper/roster/assignment";
import { countDraftedPositions, rosterSizeFromSettings, totalStarterSpots } from "@/lib/sleeper/roster/parse";
import {
  FIXED_ROSTER_SLOTS,
  FLEX_ROSTER_SLOTS,
  ROSTER_SLOT_KEYS,
  type DraftedRosterPlayer,
  type RosterNeedStatus,
  type RosterRequirements,
  type RosterSlotInstance,
  type RosterSlotKey,
  type RosterSlotStatus,
  type RosterState,
} from "@/lib/sleeper/roster/types";

function slotsWithout(slots: RosterSlotInstance[], position: RosterSlotKey) {
  return slots.filter((slot) => slot.position !== position);
}

function slotsFor(slots: RosterSlotInstance[], position: RosterSlotKey) {
  return slots.filter((slot) => slot.position === position);
}

function possibleFilled(players: DraftedRosterPlayer[], slots: RosterSlotInstance[], position: RosterSlotKey) {
  return matchingSize(players, slotsFor(slots, position));
}

function forcedFilled(players: DraftedRosterPlayer[], slots: RosterSlotInstance[], position: RosterSlotKey) {
  return Math.max(0, matchingSize(players, slots) - matchingSize(players, slotsWithout(slots, position)));
}

function statusFor(required: number, forced: number, possible: number): RosterNeedStatus {
  if (required <= 0) {
    return "fulfilled";
  }
  if (forced >= required) {
    return "fulfilled";
  }
  if (possible >= required) {
    return "at_risk";
  }
  return "needed";
}

function filledFor(required: number, forced: number, possible: number, status: RosterNeedStatus) {
  if (required <= 0) {
    return 0;
  }
  if (status === "fulfilled") {
    return required;
  }
  if (status === "at_risk") {
    return Math.min(required - 1, Math.max(0, forced));
  }
  return Math.min(required, possible);
}

export function calculateRosterNeeds(
  requirements: RosterRequirements,
  draftedPlayers: DraftedRosterPlayer[],
): RosterState {
  const fixedSlots = expandRosterSlots(requirements, FIXED_ROSTER_SLOTS);
  const fixedAssignment = calculateRosterAssignment(draftedPlayers, fixedSlots);
  const leftoverPlayers = draftedPlayers.filter((player) => !fixedAssignment.has(player.id));
  const specificFlexSlots = expandRosterSlots(requirements, ["G", "F"]);
  const utilSlots = expandRosterSlots(requirements, ["UTIL"]);
  const specificFlexAssignment = calculateRosterAssignment(leftoverPlayers, specificFlexSlots);
  const utilPlayers = leftoverPlayers.filter((player) => !specificFlexAssignment.has(player.id));
  const starterSpots = totalStarterSpots(requirements);
  const totalRosterSpots = rosterSizeFromSettings(requirements);

  const rosterSlots: RosterSlotStatus[] = ROSTER_SLOT_KEYS.map((position) => {
    const required = requirements[position];
    const isUtil = position === "UTIL";
    const isSpecificFlex = position === "G" || position === "F";
    const pool = isUtil ? utilSlots : isSpecificFlex ? specificFlexSlots : fixedSlots;
    const players = isUtil ? utilPlayers : isSpecificFlex ? leftoverPlayers : draftedPlayers;
    const forced = forcedFilled(players, pool, position);
    const possible = possibleFilled(players, pool, position);
    const status = statusFor(required, forced, possible);
    const filled = filledFor(required, forced, possible, status);
    return {
      position,
      required,
      filled,
      remaining: Math.max(0, required - filled),
      status: required <= 0 ? "fulfilled" : status,
      players: draftedPlayers
        .filter((player) => player.eligible.includes(position))
        .map((player) => player.label),
    };
  });

  const nextPriority = rosterSlots
    .filter((slot) => slot.required > 0 && slot.status !== "fulfilled")
    .sort((left, right) => {
      const urgency = (status: RosterNeedStatus) => (status === "needed" ? 0 : 1);
      const group = (position: RosterSlotKey) =>
        (FIXED_ROSTER_SLOTS as RosterSlotKey[]).includes(position) ? 0 : 1;
      return urgency(left.status) - urgency(right.status) || group(left.position) - group(right.position);
    })
    .map((slot) => slot.position);

  return {
    requirements,
    draftedPlayers: draftedPlayers.map((player) => player.label),
    rosterSlots,
    positionCounts: countDraftedPositions(draftedPlayers),
    starterSpots,
    totalRosterSpots,
    filledRosterSpots: draftedPlayers.length,
    remainingRosterSpots: Math.max(0, totalRosterSpots - draftedPlayers.length),
    nextPriority,
    flexible: FLEX_ROSTER_SLOTS.filter((position) => requirements[position] > 0),
  };
}
