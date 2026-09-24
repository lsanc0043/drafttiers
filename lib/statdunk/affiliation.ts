import type { PlayerCardData } from "@/components/players/PlayerCard";
import { nbaTeamName } from "@/lib/nba/team-colors";
import type { StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

export function foldPlayerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function lockInRowKey(player: StatdunkNormalizedPlayer) {
  return player.canonicalPlayerId ?? player.sleeperPlayerId ?? player.playerName ?? "unknown";
}

export function applyLockInTeam(
  card: PlayerCardData,
  teamAbbr: string | null | undefined,
): PlayerCardData {
  const abbr = teamAbbr?.trim().toUpperCase() || null;
  if (!abbr) {
    return card;
  }
  return {
    ...card,
    teamAbbr: abbr,
    teamName: nbaTeamName(abbr) ?? card.teamName,
  };
}

export function findLockInPlayer(
  players: StatdunkNormalizedPlayer[],
  photoIds: Record<string, number>,
  query: { nbaPersonId?: number | null; fullName?: string | null },
): StatdunkNormalizedPlayer | null {
  const nbaPersonId = query.nbaPersonId;
  if (nbaPersonId != null && Number.isFinite(nbaPersonId)) {
    for (const player of players) {
      const key = lockInRowKey(player);
      if (photoIds[key] === nbaPersonId) {
        return player;
      }
      if (Number(player.nbaPersonId) === nbaPersonId) {
        return player;
      }
    }
  }

  const queryName = foldPlayerName(query.fullName ?? "");
  if (!queryName) {
    return null;
  }
  const exact = players.filter(
    (player) => foldPlayerName(player.playerName ?? "") === queryName,
  );
  if (exact.length === 1) {
    return exact[0] ?? null;
  }
  const partial = players.filter((player) => {
    const name = foldPlayerName(player.playerName ?? "");
    return name.includes(queryName) || queryName.includes(name);
  });
  return partial.length === 1 ? (partial[0] ?? null) : exact[0] ?? null;
}

export function lockInTeamPlayers(
  players: StatdunkNormalizedPlayer[],
  team: string,
): StatdunkNormalizedPlayer[] {
  const abbr = team.trim().toUpperCase();
  if (!abbr) {
    return [];
  }
  return players.filter((player) => (player.team ?? "").toUpperCase() === abbr);
}
