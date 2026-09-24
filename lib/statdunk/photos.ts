import { normalizePlayerName } from "@/lib/sleeper/picks";
import type { StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

const SUFFIX = /^(jr|sr|ii|iii|iv|v)$/;

export type NbaPhotoDirectoryPlayer = {
  nbaPersonId: number;
  fullName: string;
  teamAbbr: string | null;
};

function nameKeys(fullName: string) {
  const normalized = normalizePlayerName(fullName);
  const parts = normalized.split(" ").filter(Boolean);
  const withoutSuffix = parts.filter((part) => !SUFFIX.test(part));
  const keys = new Set<string>([normalized]);
  if (withoutSuffix.length >= 2) {
    keys.add(withoutSuffix.join(" "));
    keys.add(`${withoutSuffix[0]} ${withoutSuffix[withoutSuffix.length - 1]}`);
  }
  keys.delete("");
  return keys;
}

function lastName(fullName: string) {
  const parts = normalizePlayerName(fullName)
    .split(" ")
    .filter((part) => part && !SUFFIX.test(part));
  return parts.at(-1) ?? null;
}

export function matchNbaPersonId(
  player: Pick<StatdunkNormalizedPlayer, "playerName" | "team">,
  directory: NbaPhotoDirectoryPlayer[],
): number | null {
  const name = player.playerName;
  if (!name) {
    return null;
  }

  const byKey = new Map<string, NbaPhotoDirectoryPlayer[]>();
  const byLastAndTeam = new Map<string, NbaPhotoDirectoryPlayer[]>();
  for (const entry of directory) {
    for (const key of nameKeys(entry.fullName)) {
      const list = byKey.get(key) ?? [];
      list.push(entry);
      byKey.set(key, list);
    }
    const last = lastName(entry.fullName);
    const team = entry.teamAbbr?.toUpperCase();
    if (last && team) {
      const key = `${last}|${team}`;
      const list = byLastAndTeam.get(key) ?? [];
      list.push(entry);
      byLastAndTeam.set(key, list);
    }
  }

  for (const key of nameKeys(name)) {
    const matches = byKey.get(key) ?? [];
    if (matches.length === 1) {
      return matches[0]?.nbaPersonId ?? null;
    }
    if (player.team && matches.length > 1) {
      const teamMatches = matches.filter((entry) => entry.teamAbbr?.toUpperCase() === player.team?.toUpperCase());
      if (teamMatches.length === 1) {
        return teamMatches[0]?.nbaPersonId ?? null;
      }
    }
  }

  const last = lastName(name);
  const team = player.team?.toUpperCase();
  if (last && team) {
    const matches = byLastAndTeam.get(`${last}|${team}`) ?? [];
    if (matches.length === 1) {
      return matches[0]?.nbaPersonId ?? null;
    }
  }

  return null;
}

export function lockInPhotoIds(
  players: StatdunkNormalizedPlayer[],
  directory: NbaPhotoDirectoryPlayer[],
): Record<string, number> {
  const photos: Record<string, number> = {};
  for (const player of players) {
    const key = player.canonicalPlayerId ?? player.sleeperPlayerId ?? player.playerName;
    if (!key) {
      continue;
    }
    const nbaPersonId = matchNbaPersonId(player, directory);
    if (nbaPersonId != null) {
      photos[key] = nbaPersonId;
    }
  }
  return photos;
}
