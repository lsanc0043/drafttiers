export const ROSTER_SLOT_KEYS = ["PG", "SG", "G", "SF", "PF", "F", "C", "UTIL"] as const;

export type RosterSlotKey = (typeof ROSTER_SLOT_KEYS)[number];

export const FIXED_ROSTER_SLOTS: RosterSlotKey[] = ["PG", "SG", "SF", "PF", "C"];
export const FLEX_ROSTER_SLOTS: RosterSlotKey[] = ["G", "F", "UTIL"];

export type RosterRequirements = {
  PG: number;
  SG: number;
  G: number;
  SF: number;
  PF: number;
  F: number;
  C: number;
  UTIL: number;
  bench: number;
  teams: number;
  rounds: number;
};

export type RosterNeedStatus = "fulfilled" | "needed" | "at_risk";

export type RosterSlotStatus = {
  position: RosterSlotKey;
  required: number;
  filled: number;
  remaining: number;
  status: RosterNeedStatus;
  players: string[];
};

export type DraftedRosterPlayer = {
  id: string;
  label: string;
  eligible: RosterSlotKey[];
  sleeperPosition: string;
};

export type PositionCount = {
  position: string;
  count: number;
  players: string[];
};

export type RosterState = {
  requirements: RosterRequirements;
  draftedPlayers: string[];
  rosterSlots: RosterSlotStatus[];
  positionCounts: PositionCount[];
  starterSpots: number;
  totalRosterSpots: number;
  filledRosterSpots: number;
  remainingRosterSpots: number;
  nextPriority: RosterSlotKey[];
  flexible: RosterSlotKey[];
};

export type RosterSlotInstance = {
  id: string;
  position: RosterSlotKey;
};
