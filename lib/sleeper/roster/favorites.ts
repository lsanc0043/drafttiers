import {
  calculateRosterAssignment,
  expandRosterSlots,
} from "@/lib/sleeper/roster/assignment";
import {
  parseRosterRequirements,
  rosterSizeFromSettings,
  totalStarterSpots,
} from "@/lib/sleeper/roster/parse";
import {
  ROSTER_SLOT_KEYS,
  type DraftedRosterPlayer,
  type RosterRequirements,
  type RosterSlotKey,
} from "@/lib/sleeper/roster/types";

export type FavoriteLineupStatus = "empty" | "incomplete" | "legal" | "illegal";

export type FavoriteLineupSlot = {
  slotId: string;
  position: RosterSlotKey | "BN";
  playerId: string | null;
  label: string | null;
};

export type FavoriteLineupEvaluation = {
  requirements: RosterRequirements;
  usingDefaultSlots: boolean;
  starterSpots: number;
  rosterSpots: number;
  startersFilled: number;
  assignment: FavoriteLineupSlot[];
  bench: DraftedRosterPlayer[];
  overflow: DraftedRosterPlayer[];
  missingPositions: RosterSlotKey[];
  status: FavoriteLineupStatus;
  summary: string;
};

export function defaultNbaRosterRequirements(input?: {
  teams?: number | null;
  rounds?: number | null;
}): RosterRequirements {
  return parseRosterRequirements({
    settings: {
      slots_pg: 1,
      slots_sg: 1,
      slots_g: 1,
      slots_sf: 1,
      slots_pf: 1,
      slots_f: 1,
      slots_c: 1,
      slots_util: 2,
      slots_bn: 4,
      teams: input?.teams ?? 12,
      rounds: 13,
    },
  });
}

export function resolveBoardRosterRequirements(
  _sleeperRequirements?: RosterRequirements | null,
  draftSettings?: { teamCount?: number | null; roundCount?: number | null } | null,
): { requirements: RosterRequirements; usingDefaultSlots: boolean } {
  return {
    requirements: defaultNbaRosterRequirements({
      teams: draftSettings?.teamCount,
    }),
    usingDefaultSlots: true,
  };
}

function uniquePositions(positions: RosterSlotKey[]) {
  return [...new Set(positions)];
}

export function evaluateFavoriteLineup(
  requirements: RosterRequirements,
  players: DraftedRosterPlayer[],
  usingDefaultSlots = false,
): FavoriteLineupEvaluation {
  const starterSlots = expandRosterSlots(requirements, [...ROSTER_SLOT_KEYS]);
  const starterSpots = totalStarterSpots(requirements);
  const rosterSpots = rosterSizeFromSettings(requirements);
  const assigned = calculateRosterAssignment(players, starterSlots);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const assignedIds = new Set(assigned.keys());
  const leftover = players.filter((player) => !assignedIds.has(player.id));
  const benchSpots = requirements.bench;
  const bench = leftover.slice(0, benchSpots);
  const overflow = leftover.slice(benchSpots);
  const playerBySlotId = new Map<string, string>();
  for (const [playerId, slot] of assigned) {
    playerBySlotId.set(slot.id, playerId);
  }
  const starterAssignment: FavoriteLineupSlot[] = starterSlots.map((slot) => {
    const playerId = playerBySlotId.get(slot.id) ?? null;
    const player = playerId ? playersById.get(playerId) : null;
    return {
      slotId: slot.id,
      position: slot.position,
      playerId,
      label: player?.label ?? null,
    };
  });
  const assignment: FavoriteLineupSlot[] = [
    ...starterAssignment,
    ...Array.from({ length: benchSpots }, (_, index) => {
      const player = bench[index];
      return {
        slotId: `BN-${index}`,
        position: "BN" as const,
        playerId: player?.id ?? null,
        label: player?.label ?? null,
      };
    }),
  ];
  const missingPositions = uniquePositions(
    starterAssignment
      .filter((slot) => slot.playerId == null)
      .map((slot) => slot.position)
      .filter((position): position is RosterSlotKey => position !== "BN"),
  );
  const startersFilled = assigned.size;

  let status: FavoriteLineupStatus = "empty";
  let summary = "Star players to build a sample roster.";
  if (players.length > 0) {
    const blockedByMix = missingPositions.length > 0 && leftover.length > 0;
    const tooMany = overflow.length > 0;
    if (missingPositions.length === 0 && overflow.length === 0) {
      status = "legal";
      summary =
        leftover.length > 0
          ? `Legal team: starters filled, ${leftover.length} on the bench.`
          : "Legal team: every starter slot is filled.";
    } else if (blockedByMix || tooMany) {
      status = "illegal";
      const parts: string[] = [];
      if (blockedByMix) {
        parts.push(`cannot fill ${missingPositions.join(", ")} with the leftover favorites`);
      }
      if (tooMany) {
        parts.push(`${overflow.length} extra ${overflow.length === 1 ? "player" : "players"} over roster size`);
      }
      summary = `Not a legal team: ${parts.join("; ")}.`;
    } else {
      status = "incomplete";
      summary = `Incomplete: still need ${missingPositions.join(", ")}.`;
    }
  }

  return {
    requirements,
    usingDefaultSlots,
    starterSpots,
    rosterSpots,
    startersFilled,
    assignment,
    bench,
    overflow,
    missingPositions,
    status,
    summary,
  };
}
