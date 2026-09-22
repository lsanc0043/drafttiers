import {
  ROSTER_SLOT_KEYS,
  type DraftedRosterPlayer,
  type PositionCount,
  type RosterRequirements,
  type RosterSlotKey,
} from "@/lib/sleeper/roster/types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asNonNegativeInt(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
}

const SLOT_SETTING_KEYS: Record<RosterSlotKey, string[]> = {
  PG: ["slots_pg", "slots_PG"],
  SG: ["slots_sg", "slots_SG"],
  G: ["slots_g", "slots_G"],
  SF: ["slots_sf", "slots_SF"],
  PF: ["slots_pf", "slots_PF"],
  F: ["slots_f", "slots_F"],
  C: ["slots_c", "slots_C"],
  UTIL: ["slots_util", "slots_UTIL"],
};

function emptyRequirements(): RosterRequirements {
  return {
    PG: 0,
    SG: 0,
    G: 0,
    SF: 0,
    PF: 0,
    F: 0,
    C: 0,
    UTIL: 0,
    bench: 0,
    teams: 0,
    rounds: 0,
  };
}

function normalizeSlotToken(value: unknown): RosterSlotKey | null {
  const token = String(value ?? "")
    .trim()
    .toUpperCase();
  if ((ROSTER_SLOT_KEYS as readonly string[]).includes(token)) {
    return token as RosterSlotKey;
  }
  return null;
}

function settingsHaveRosterSlots(settings: Record<string, unknown>) {
  return ROSTER_SLOT_KEYS.some((slot) =>
    SLOT_SETTING_KEYS[slot].some((key) => settings[key] != null),
  );
}

function fromSettings(settings: Record<string, unknown>): RosterRequirements {
  const requirements = emptyRequirements();
  for (const slot of ROSTER_SLOT_KEYS) {
    const keys = SLOT_SETTING_KEYS[slot];
    const found = keys.find((key) => settings[key] != null);
    requirements[slot] = found ? asNonNegativeInt(settings[found]) : 0;
  }
  requirements.bench = asNonNegativeInt(
    settings.slots_bn ?? settings.slots_BN ?? settings.slots_bench,
  );
  requirements.teams = asNonNegativeInt(settings.teams ?? settings.num_teams);
  requirements.rounds = asNonNegativeInt(settings.rounds ?? settings.draft_rounds);
  return requirements;
}

function fromRosterPositions(positions: unknown[]): RosterRequirements {
  const requirements = emptyRequirements();
  for (const position of positions) {
    const token = String(position ?? "")
      .trim()
      .toUpperCase();
    if (token === "BN" || token === "BENCH") {
      requirements.bench += 1;
      continue;
    }
    const slot = normalizeSlotToken(position);
    if (slot) {
      requirements[slot] += 1;
    }
  }
  return requirements;
}

export function parseRosterRequirements(input?: {
  settings?: unknown;
  rosterPositions?: unknown;
  teams?: unknown;
  rounds?: unknown;
} | null): RosterRequirements {
  const settings = asRecord(input?.settings);
  const requirements = settingsHaveRosterSlots(settings)
    ? fromSettings(settings)
    : Array.isArray(input?.rosterPositions)
      ? fromRosterPositions(input.rosterPositions)
      : emptyRequirements();

  if (!requirements.teams) {
    requirements.teams = asNonNegativeInt(input?.teams ?? settings.teams ?? settings.num_teams);
  }
  if (!requirements.rounds) {
    requirements.rounds = asNonNegativeInt(
      input?.rounds ?? settings.rounds ?? settings.draft_rounds,
    );
  }
  return requirements;
}

export function totalStarterSpots(requirements: RosterRequirements) {
  return ROSTER_SLOT_KEYS.reduce((sum, slot) => sum + requirements[slot], 0);
}

export function rosterSizeFromSettings(requirements: RosterRequirements) {
  if (requirements.rounds > 0) {
    return requirements.rounds;
  }
  return totalStarterSpots(requirements) + requirements.bench;
}

export function countDraftedPositions(players: DraftedRosterPlayer[]): PositionCount[] {
  const grouped = new Map<string, string[]>();
  for (const player of players) {
    const position = player.sleeperPosition;
    if (!position) {
      continue;
    }
    const names = grouped.get(position) ?? [];
    names.push(player.label);
    grouped.set(position, names);
  }
  return [...grouped.entries()]
    .map(([position, names]) => ({ position, count: names.length, players: names }))
    .sort((left, right) => right.count - left.count || left.position.localeCompare(right.position));
}
