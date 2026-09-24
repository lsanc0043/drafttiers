import { normalizePlayerName } from "@/lib/nba/injuries";
import { sleeperGetJson } from "@/lib/sleeper/client";

const TTL_MS = 12 * 60 * 60 * 1000;

type SleeperNbaPlayer = {
  player_id?: unknown;
  full_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  team?: unknown;
};

type Entry = {
  id: string;
  team: string | null;
};

let cache: { at: number; byName: Map<string, Entry[]> } | null = null;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function nameIndex(): Promise<Map<string, Entry[]>> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.byName;
  }
  const players = await sleeperGetJson<Record<string, SleeperNbaPlayer>>("/players/nba");
  const byName = new Map<string, Entry[]>();
  for (const [id, player] of Object.entries(players ?? {})) {
    const fullName =
      asString(player.full_name) ??
      [asString(player.first_name), asString(player.last_name)].filter(Boolean).join(" ");
    const key = normalizePlayerName(fullName);
    if (!key) {
      continue;
    }
    const list = byName.get(key) ?? [];
    list.push({
      id: asString(player.player_id) ?? id,
      team: asString(player.team)?.toUpperCase() ?? null,
    });
    byName.set(key, list);
  }
  cache = { at: Date.now(), byName };
  return byName;
}

export async function resolveSleeperNbaPlayerId(
  fullName: string,
  teamAbbr?: string | null,
): Promise<string | null> {
  const key = normalizePlayerName(fullName);
  if (!key) {
    return null;
  }
  const matches = (await nameIndex()).get(key) ?? [];
  if (matches.length === 0) {
    return null;
  }
  const team = teamAbbr?.trim().toUpperCase() ?? null;
  if (team) {
    const teamMatch = matches.filter((entry) => !entry.team || entry.team === team);
    if (teamMatch.length === 1) {
      return teamMatch[0]?.id ?? null;
    }
    if (teamMatch.length > 1) {
      return teamMatch[0]?.id ?? null;
    }
  }
  return matches.length === 1 ? (matches[0]?.id ?? null) : (matches[0]?.id ?? null);
}
