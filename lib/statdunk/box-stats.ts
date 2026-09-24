import { usageRate, type UsageBox } from "@/lib/nba/usage";
import type { JsonRecord, StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

function asRecord(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

export type LockInBoxStats = {
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  min: number | null;
  fgm: number | null;
  fga: number | null;
  fgPct: number | null;
  ftm: number | null;
  fta: number | null;
  ftPct: number | null;
  tpm: number | null;
  tpa: number | null;
  tpPct: number | null;
  usg: number | null;
};

function perGame(total: number | null, games: number | null): number | null {
  if (total == null || games == null || games <= 0) {
    return null;
  }
  return total / games;
}

function pct(made: number | null, attempted: number | null): number | null {
  if (made == null || attempted == null || attempted <= 0) {
    return null;
  }
  return (100 * made) / attempted;
}

export function lockInProjectedStats(player: StatdunkNormalizedPlayer): JsonRecord | null {
  return asRecord(asRecord(player.original.v3LockIn)?.projectedStats) ??
    asRecord(asRecord(player.original.projectionTable)?.projectedStats);
}

export function lockInUsageByTeam(players: StatdunkNormalizedPlayer[]): Map<string, UsageBox> {
  const teams = new Map<string, UsageBox>();
  for (const player of players) {
    const team = player.team;
    const stats = lockInProjectedStats(player);
    if (!team || !stats) {
      continue;
    }
    const current = teams.get(team) ?? {
      fieldGoalsAttempted: 0,
      freeThrowsAttempted: 0,
      turnovers: 0,
      minutes: 0,
    };
    current.fieldGoalsAttempted += asNumber(stats.fga) ?? 0;
    current.freeThrowsAttempted += asNumber(stats.fta) ?? 0;
    current.turnovers += asNumber(stats.to) ?? 0;
    current.minutes += asNumber(stats.min) ?? player.minutes ?? 0;
    teams.set(team, current);
  }
  return teams;
}

export function lockInBoxStats(
  player: StatdunkNormalizedPlayer,
  teamUsage: Map<string, UsageBox>,
): LockInBoxStats {
  const stats = lockInProjectedStats(player);
  const games = player.gamesPlayed;
  const fgm = asNumber(stats?.fgm);
  const fga = asNumber(stats?.fga);
  const ftm = asNumber(stats?.ftm);
  const fta = asNumber(stats?.fta);
  const tpm = asNumber(stats?.tpm);
  const tpa = asNumber(stats?.tpa);
  const minutes = asNumber(stats?.min) ?? player.minutes;
  const turnovers = asNumber(stats?.to);
  const team = player.team ? teamUsage.get(player.team) : undefined;
  const playerBox: UsageBox = {
    fieldGoalsAttempted: fga ?? 0,
    freeThrowsAttempted: fta ?? 0,
    turnovers: turnovers ?? 0,
    minutes: minutes ?? 0,
  };

  return {
    pts: perGame(asNumber(stats?.pts), games),
    reb: perGame(asNumber(stats?.reb), games),
    ast: perGame(asNumber(stats?.ast), games),
    stl: perGame(asNumber(stats?.stl), games),
    blk: perGame(asNumber(stats?.blk), games),
    tov: perGame(turnovers, games),
    min: perGame(minutes, games),
    fgm: perGame(fgm, games),
    fga: perGame(fga, games),
    fgPct: pct(fgm, fga),
    ftm: perGame(ftm, games),
    fta: perGame(fta, games),
    ftPct: pct(ftm, fta),
    tpm: perGame(tpm, games),
    tpa: perGame(tpa, games),
    tpPct: pct(tpm, tpa),
    usg: team && games != null ? usageRate(playerBox, team, games) : null,
  };
}
