import { sleeperGetJson } from "@/lib/sleeper/client";
import { sleeperPositionLabel } from "@/lib/sleeper/roster/eligibility";

const TTL_MS = 12 * 60 * 60 * 1000;

type Cache = {
  at: number;
  map: Record<string, string[]>;
};

let cache: Cache | null = null;

type SleeperNbaPlayer = {
  fantasy_positions?: unknown;
  position?: unknown;
};

function asPositionList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((part) => String(part).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return sleeperPositionLabel(value).split("/").filter(Boolean);
  }
  return [];
}

export async function getNbaFantasyPositionMap(): Promise<Record<string, string[]>> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.map;
  }
  const players = await sleeperGetJson<Record<string, SleeperNbaPlayer>>("/players/nba");
  const map: Record<string, string[]> = {};
  for (const [playerId, player] of Object.entries(players ?? {})) {
    const positions = asPositionList(player?.fantasy_positions);
    const fallback = asPositionList(player?.position);
    const resolved = positions.length > 0 ? positions : fallback;
    if (resolved.length > 0) {
      map[playerId] = resolved;
    }
  }
  cache = { at: Date.now(), map };
  return map;
}

export function mergeFantasyPositions(metadata: unknown, positions: string[] | undefined) {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  if (positions && positions.length > 0) {
    record.fantasy_positions = positions;
    record.position = sleeperPositionLabel(positions);
  }
  return record;
}

export async function withNbaFantasyPositions<
  T extends { playerId?: string | null; player_id?: string | number | null; metadata?: unknown },
>(picks: T[]): Promise<T[]> {
  if (picks.length === 0) {
    return picks;
  }
  try {
    const map = await getNbaFantasyPositionMap();
    return picks.map((pick) => {
      const playerId = String(pick.playerId ?? pick.player_id ?? "");
      return {
        ...pick,
        metadata: mergeFantasyPositions(pick.metadata, playerId ? map[playerId] : undefined),
      };
    });
  } catch {
    return picks;
  }
}
