import { STARTING_FIVE_SLOTS, type StartingFiveSlot } from "@/lib/statdunk/starting-five";
import { sleeperGetJson } from "@/lib/sleeper/client";

const TTL_MS = 12 * 60 * 60 * 1000;
const DEPTH_PER_SLOT = 3;

export type SleeperDepthEntry = {
  sleeperPlayerId: string;
  fullName: string;
  slot: StartingFiveSlot;
  order: number;
};

type SleeperNbaPlayer = {
  player_id?: unknown;
  full_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  team?: unknown;
  status?: unknown;
  position?: unknown;
  depth_chart_position?: unknown;
  depth_chart_order?: unknown;
};

type Cache = {
  at: number;
  players: SleeperNbaPlayer[];
};

let cache: Cache | null = null;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asSlot(value: unknown): StartingFiveSlot | null {
  const slot = asString(value)?.toUpperCase();
  return STARTING_FIVE_SLOTS.includes(slot as StartingFiveSlot)
    ? (slot as StartingFiveSlot)
    : null;
}

function asOrder(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function sleeperDepthChart(
  players: SleeperNbaPlayer[],
  team: string,
): Record<StartingFiveSlot, SleeperDepthEntry[]> {
  const abbr = team.trim().toUpperCase();
  const grouped: Record<StartingFiveSlot, SleeperDepthEntry[]> = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: [],
  };
  if (!abbr) {
    return grouped;
  }

  for (const player of players) {
    if (asString(player.team)?.toUpperCase() !== abbr) {
      continue;
    }
    if (asString(player.position)?.toUpperCase() === "DEF") {
      continue;
    }
    const slot = asSlot(player.depth_chart_position);
    const order = asOrder(player.depth_chart_order);
    const fullName =
      asString(player.full_name) ??
      [asString(player.first_name), asString(player.last_name)].filter(Boolean).join(" ");
    if (!slot || order == null || !fullName) {
      continue;
    }
    grouped[slot].push({
      sleeperPlayerId: asString(player.player_id) ?? fullName,
      fullName,
      slot,
      order,
    });
  }

  for (const slot of STARTING_FIVE_SLOTS) {
    grouped[slot] = grouped[slot]
      .sort((left, right) => left.order - right.order)
      .slice(0, DEPTH_PER_SLOT);
  }
  return grouped;
}

async function loadSleeperNbaPlayers(): Promise<SleeperNbaPlayer[]> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.players;
  }
  const payload = await sleeperGetJson<Record<string, SleeperNbaPlayer>>("/players/nba");
  const players = Object.entries(payload ?? {}).map(([id, player]) => ({
    ...player,
    player_id: asString(player.player_id) ?? id,
  }));
  cache = { at: Date.now(), players };
  return players;
}

export async function loadSleeperTeamDepth(
  team: string,
): Promise<Record<StartingFiveSlot, SleeperDepthEntry[]>> {
  const players = await loadSleeperNbaPlayers();
  return sleeperDepthChart(players, team);
}
