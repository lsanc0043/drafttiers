import type { PlayerCardData } from "@/components/players/PlayerCard";
import { lockInBoxStats, lockInUsageByTeam } from "@/lib/statdunk/box-stats";
import type { StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

export const STARTING_FIVE_SLOTS = ["PG", "SG", "SF", "PF", "C"] as const;
export type StartingFiveSlot = (typeof STARTING_FIVE_SLOTS)[number];
export const POSITION_DEPTH = 3;
export const DEPTH_LABELS = ["Starter", "2nd", "3rd"] as const;

export type PredictedStarter = {
  slot: StartingFiveSlot;
  rowKey: string;
  player: StatdunkNormalizedPlayer;
  minutes: number | null;
};

export type DepthChartRow = {
  slot: StartingFiveSlot;
  depth: (PredictedStarter | null)[];
};

export type LockInStartingFivePlayer = {
  slot: StartingFiveSlot;
  minutes: number | null;
  fullName: string;
  nbaPersonId: number | null;
  isRookie: boolean;
  player: PlayerCardData | null;
};

export type LockInDepthChartRow = {
  slot: StartingFiveSlot;
  depth: (LockInStartingFivePlayer | null)[];
};

type RankedPlayer = {
  player: StatdunkNormalizedPlayer;
  rowKey: string;
  minutes: number | null;
  positions: StartingFiveSlot[];
};

function playerKey(player: StatdunkNormalizedPlayer) {
  return player.canonicalPlayerId ?? player.sleeperPlayerId ?? player.playerName ?? "unknown";
}

function splitPositions(player: StatdunkNormalizedPlayer): StartingFiveSlot[] {
  const raw = player.fantasyPositions.length
    ? player.fantasyPositions
    : player.position
      ? [player.position]
      : [];
  const values = new Set<StartingFiveSlot>();
  for (const item of raw) {
    for (const part of item.split(/[/,]/)) {
      const position = part.trim().toUpperCase();
      if (STARTING_FIVE_SLOTS.includes(position as StartingFiveSlot)) {
        values.add(position as StartingFiveSlot);
      }
    }
  }
  return [...values];
}

function rankTeamPlayers(players: StatdunkNormalizedPlayer[], team: string): RankedPlayer[] {
  const abbr = team.trim().toUpperCase();
  if (!abbr) {
    return [];
  }

  const teamPlayers = players.filter(
    (player) => (player.team ?? "").toUpperCase() === abbr,
  );
  const teamUsage = lockInUsageByTeam(teamPlayers);
  return teamPlayers
    .map((player) => ({
      player,
      rowKey: playerKey(player),
      minutes: lockInBoxStats(player, teamUsage).min,
      positions: splitPositions(player),
    }))
    .filter((row) => row.minutes != null && row.minutes > 0)
    .sort((left, right) => (right.minutes ?? 0) - (left.minutes ?? 0));
}

function toPredicted(slot: StartingFiveSlot, row: RankedPlayer): PredictedStarter {
  return {
    slot,
    rowKey: row.rowKey,
    player: row.player,
    minutes: row.minutes,
  };
}

function assignLayer(
  ranked: RankedPlayer[],
  used: Set<string>,
  fillLeftovers: boolean,
): Map<StartingFiveSlot, RankedPlayer> {
  const assigned = new Map<StartingFiveSlot, RankedPlayer>();
  const available = ranked.filter((row) => !used.has(row.rowKey));
  const layerUsed = new Set<string>();

  for (const row of available) {
    for (const slot of STARTING_FIVE_SLOTS) {
      if (assigned.has(slot) || !row.positions.includes(slot)) {
        continue;
      }
      assigned.set(slot, row);
      layerUsed.add(row.rowKey);
      break;
    }
  }

  if (fillLeftovers) {
    const leftovers = available.filter((row) => !layerUsed.has(row.rowKey));
    for (const slot of STARTING_FIVE_SLOTS) {
      if (assigned.has(slot)) {
        continue;
      }
      const next = leftovers.shift();
      if (!next) {
        break;
      }
      assigned.set(slot, next);
      layerUsed.add(next.rowKey);
    }
  }

  for (const key of layerUsed) {
    used.add(key);
  }
  return assigned;
}

export function predictedStartingFive(
  players: StatdunkNormalizedPlayer[],
  team: string,
): PredictedStarter[] {
  const ranked = rankTeamPlayers(players, team);
  const assigned = assignLayer(ranked, new Set(), true);
  return STARTING_FIVE_SLOTS.flatMap((slot) => {
    const row = assigned.get(slot);
    return row ? [toPredicted(slot, row)] : [];
  });
}

export function predictedDepthChart(
  players: StatdunkNormalizedPlayer[],
  team: string,
): DepthChartRow[] {
  const ranked = rankTeamPlayers(players, team);
  const used = new Set<string>();
  const layers = Array.from({ length: POSITION_DEPTH }, () =>
    assignLayer(ranked, used, false),
  );
  return STARTING_FIVE_SLOTS.map((slot) => ({
    slot,
    depth: layers.map((layer) => {
      const row = layer.get(slot);
      return row ? toPredicted(slot, row) : null;
    }),
  }));
}
