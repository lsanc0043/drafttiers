import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PlayerCardData } from "@/components/players/PlayerCard";
import { prisma } from "@/lib/db/prisma";
import { getInjuryIndex, getPlayerInjury, type InjuryIndex, type InjuryLabel } from "@/lib/nba/injuries";
import { isRookieForLeagueYear, LOCK_IN_SEASON } from "@/lib/nba/season";
import { nbaTeamName } from "@/lib/nba/team-colors";
import { loadSleeperTeamDepth, type SleeperDepthEntry } from "@/lib/sleeper/team-depth";
import { applyLockInTeam, findLockInPlayer, foldPlayerName, lockInRowKey, lockInTeamPlayers } from "@/lib/statdunk/affiliation";
import { lockInBoxStats, lockInUsageByTeam } from "@/lib/statdunk/box-stats";
import { lockInPhotoIds } from "@/lib/statdunk/photos";
import {
  POSITION_DEPTH,
  STARTING_FIVE_SLOTS,
  predictedDepthChart,
  predictedStartingFive,
  type LockInDepthChartRow,
  type LockInStartingFivePlayer,
  type PredictedStarter,
} from "@/lib/statdunk/starting-five";
import type { StatdunkLockInDataset, StatdunkNormalizedPlayer } from "@/lib/statdunk/types";

export type LockInInjury = {
  label: InjuryLabel;
  url: string | null;
};

export type NbaDirectoryPlayer = {
  id: string;
  nbaPersonId: number;
  fullName: string;
  teamAbbr: string | null;
  teamName: string | null;
  position: string | null;
  jerseyNumber: string | null;
  isActive: boolean;
  isRookie: boolean;
};

export type LockInBundle = {
  dataset: StatdunkLockInDataset;
  photoIds: Record<string, number>;
  directoryPlayers: Record<string, PlayerCardData>;
  nbaPlayers: NbaDirectoryPlayer[];
  injuries: Record<string, LockInInjury>;
};

let bundlePromise: Promise<LockInBundle | null> | null = null;

function playerKey(player: StatdunkNormalizedPlayer) {
  return player.canonicalPlayerId ?? player.sleeperPlayerId ?? player.playerName ?? "unknown";
}

async function loadDataset(): Promise<StatdunkLockInDataset | null> {
  try {
    const filePath = path.join(process.cwd(), "data", "statdunk", "statdunk-lock-in.json");
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as StatdunkLockInDataset;
  } catch {
    return null;
  }
}

async function loadDirectory(dataset: StatdunkLockInDataset): Promise<{
  photoIds: Record<string, number>;
  directoryPlayers: Record<string, PlayerCardData>;
  nbaPlayers: NbaDirectoryPlayer[];
}> {
  try {
    const directory = await prisma.player.findMany({
      select: {
        id: true,
        nbaPersonId: true,
        fullName: true,
        teamAbbr: true,
        teamName: true,
        position: true,
        jerseyNumber: true,
        isActive: true,
        fromYear: true,
      },
    });
    const photoIds = lockInPhotoIds(dataset.players, directory);
    const byNba = new Map(directory.map((player) => [player.nbaPersonId, player]));
    const directoryPlayers: Record<string, PlayerCardData> = {};
    const nbaPlayers: NbaDirectoryPlayer[] = directory.map((row) => ({
      id: row.id,
      nbaPersonId: row.nbaPersonId,
      fullName: row.fullName,
      teamAbbr: row.teamAbbr,
      teamName: row.teamName,
      position: row.position,
      jerseyNumber: row.jerseyNumber,
      isActive: row.isActive,
      isRookie: isRookieForLeagueYear(row.fromYear),
    }));
    for (const player of dataset.players) {
      const key = playerKey(player);
      const nbaPersonId = photoIds[key];
      const row = nbaPersonId != null ? byNba.get(nbaPersonId) : undefined;
      if (!row) {
        continue;
      }
      directoryPlayers[key] = applyLockInTeam(
        {
          id: row.id,
          nbaPersonId: row.nbaPersonId,
          fullName: row.fullName,
          teamAbbr: row.teamAbbr,
          teamName: row.teamName,
          position: row.position,
          jerseyNumber: row.jerseyNumber,
          isActive: row.isActive,
          isRookie: isRookieForLeagueYear(row.fromYear),
        },
        player.team,
      );
    }
    return { photoIds, directoryPlayers, nbaPlayers };
  } catch {
    return { photoIds: {}, directoryPlayers: {}, nbaPlayers: [] };
  }
}

async function loadInjuries(
  players: StatdunkNormalizedPlayer[],
): Promise<Record<string, LockInInjury>> {
  try {
    const index = await getInjuryIndex();
    const injuries: Record<string, LockInInjury> = {};
    for (const player of players) {
      const injury = getPlayerInjury(
        { fullName: player.playerName ?? "", teamAbbr: player.team },
        index,
      );
      if (injury) {
        injuries[playerKey(player)] = { label: injury.label, url: injury.url };
      }
    }
    return injuries;
  } catch {
    return {};
  }
}

export async function loadLockInBundle(): Promise<LockInBundle | null> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const dataset = await loadDataset();
      if (!dataset) {
        return null;
      }
      const directory = await loadDirectory(dataset);
      const injuries = await loadInjuries(dataset.players);
      return {
        dataset,
        photoIds: directory.photoIds,
        directoryPlayers: directory.directoryPlayers,
        nbaPlayers: directory.nbaPlayers,
        injuries,
      };
    })();
  }
  return bundlePromise;
}

function toStartingFivePlayer(
  bundle: LockInBundle,
  row: PredictedStarter,
): LockInStartingFivePlayer {
  const directory = bundle.directoryPlayers[row.rowKey];
  const injury = bundle.injuries[row.rowKey];
  const nbaPersonId = directory?.nbaPersonId ?? bundle.photoIds[row.rowKey] ?? null;
  const player = directory
    ? applyLockInTeam(
        {
          ...directory,
          isInjured: injury != null,
          injuryLabel: injury?.label ?? directory.injuryLabel,
          injuryUrl: injury?.url ?? directory.injuryUrl,
        },
        row.player.team,
      )
    : null;
  return {
    slot: row.slot,
    minutes: row.minutes,
    fullName: player?.fullName ?? row.player.playerName ?? "Unknown",
    nbaPersonId,
    isRookie: player?.isRookie ?? false,
    player,
  };
}

export async function loadLockInStartingFive(
  team: string,
): Promise<LockInStartingFivePlayer[]> {
  const bundle = await loadLockInBundle();
  if (!bundle) {
    return [];
  }
  return predictedStartingFive(bundle.dataset.players, team).map((row) =>
    toStartingFivePlayer(bundle, row),
  );
}

function minutesFromLockIn(
  bundle: LockInBundle,
  player: StatdunkNormalizedPlayer,
  teamUsage: ReturnType<typeof lockInUsageByTeam>,
) {
  return lockInBoxStats(player, teamUsage).min;
}

function findLockInBySleeper(
  bundle: LockInBundle,
  entry: SleeperDepthEntry,
): StatdunkNormalizedPlayer | null {
  const sleeperId = entry.sleeperPlayerId;
  const byId = bundle.dataset.players.find((player) => player.sleeperPlayerId === sleeperId);
  if (byId) {
    return byId;
  }
  const folded = foldPlayerName(entry.fullName);
  const matches = bundle.dataset.players.filter(
    (player) => foldPlayerName(player.playerName ?? "") === folded,
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function findNbaPlayer(bundle: LockInBundle, fullName: string): NbaDirectoryPlayer | null {
  const folded = foldPlayerName(fullName);
  const matches = bundle.nbaPlayers.filter((player) => foldPlayerName(player.fullName) === folded);
  return matches.length === 1 ? (matches[0] ?? null) : (matches[0] ?? null);
}

function toDepthCell(
  bundle: LockInBundle,
  entry: SleeperDepthEntry,
  team: string,
  teamUsage: ReturnType<typeof lockInUsageByTeam>,
  injuryIndex: InjuryIndex,
): LockInStartingFivePlayer {
  const lockIn = findLockInBySleeper(bundle, entry);
  if (lockIn) {
    return toStartingFivePlayer(bundle, {
      slot: entry.slot,
      rowKey: lockInRowKey(lockIn),
      player: lockIn,
      minutes: minutesFromLockIn(bundle, lockIn, teamUsage),
    });
  }

  const nba = findNbaPlayer(bundle, entry.fullName);
  const injury = getPlayerInjury(
    { fullName: nba?.fullName ?? entry.fullName, teamAbbr: team },
    injuryIndex,
  );
  const card = applyLockInTeam(
    {
      id: nba?.id ?? `sleeper:${entry.sleeperPlayerId}`,
      nbaPersonId: nba?.nbaPersonId ?? 0,
      fullName: nba?.fullName ?? entry.fullName,
      teamAbbr: team,
      teamName: nbaTeamName(team) ?? team,
      position: nba?.position ?? entry.slot,
      jerseyNumber: nba?.jerseyNumber ?? null,
      isActive: nba?.isActive ?? true,
      isRookie: nba?.isRookie ?? false,
      isInjured: injury != null,
      injuryLabel: injury?.label ?? null,
      injuryUrl: injury?.url ?? null,
    },
    team,
  );
  return {
    slot: entry.slot,
    minutes: null,
    fullName: card.fullName,
    nbaPersonId: card.nbaPersonId || null,
    isRookie: card.isRookie,
    player: card,
  };
}

function predictedDepthFromLockIn(bundle: LockInBundle, team: string): LockInDepthChartRow[] {
  return predictedDepthChart(bundle.dataset.players, team).map((row) => ({
    slot: row.slot,
    depth: row.depth.map((cell) => (cell ? toStartingFivePlayer(bundle, cell) : null)),
  }));
}

export async function loadLockInDepthChart(team: string): Promise<LockInDepthChartRow[]> {
  const bundle = await loadLockInBundle();
  if (!bundle) {
    return [];
  }
  try {
    const grouped = await loadSleeperTeamDepth(team);
    const hasAny = STARTING_FIVE_SLOTS.some((slot) => grouped[slot].length > 0);
    if (!hasAny) {
      return predictedDepthFromLockIn(bundle, team);
    }
    const teamUsage = lockInUsageByTeam(bundle.dataset.players);
    const injuryIndex = await getInjuryIndex();
    return STARTING_FIVE_SLOTS.map((slot) => ({
      slot,
      depth: Array.from({ length: POSITION_DEPTH }, (_, index) => {
        const entry = grouped[slot][index];
        return entry ? toDepthCell(bundle, entry, team, teamUsage, injuryIndex) : null;
      }),
    }));
  } catch {
    return predictedDepthFromLockIn(bundle, team);
  }
}

export type LockInRoster = {
  team: string;
  teamName: string;
  season: string;
  players: PlayerCardData[];
  starters: LockInStartingFivePlayer[];
  depthChart: LockInDepthChartRow[];
};

function toRosterCard(
  bundle: LockInBundle,
  player: StatdunkNormalizedPlayer,
  teamUsage: ReturnType<typeof lockInUsageByTeam>,
): PlayerCardData {
  const rowKey = lockInRowKey(player);
  const directory = bundle.directoryPlayers[rowKey];
  const injury = bundle.injuries[rowKey];
  const box = lockInBoxStats(player, teamUsage);
  if (directory) {
    return applyLockInTeam(
      {
        ...directory,
        isInjured: injury != null,
        injuryLabel: injury?.label ?? directory.injuryLabel,
        injuryUrl: injury?.url ?? directory.injuryUrl,
        avgFantasyPoints: player.expectedFptsPerActiveWeek,
        avgPoints: box.pts,
        avgRebounds: box.reb,
        avgAssists: box.ast,
      },
      player.team,
    );
  }
  const nbaPersonId = bundle.photoIds[rowKey];
  if (nbaPersonId == null) {
    return applyLockInTeam(
      {
        id: rowKey,
        nbaPersonId: 0,
        fullName: player.playerName ?? "Unknown",
        teamAbbr: player.team,
        teamName: nbaTeamName(player.team) ?? player.team,
        position: player.position,
        jerseyNumber: null,
        isActive: true,
        isRookie: false,
        isInjured: injury != null,
        injuryLabel: injury?.label ?? null,
        injuryUrl: injury?.url ?? null,
        avgFantasyPoints: player.expectedFptsPerActiveWeek,
        avgPoints: box.pts,
        avgRebounds: box.reb,
        avgAssists: box.ast,
      },
      player.team,
    );
  }
  return applyLockInTeam(
    {
      id: String(nbaPersonId),
      nbaPersonId,
      fullName: player.playerName ?? "Unknown",
      teamAbbr: player.team,
      teamName: nbaTeamName(player.team) ?? player.team,
      position: player.position,
      jerseyNumber: null,
      isActive: true,
      isRookie: false,
      isInjured: injury != null,
      injuryLabel: injury?.label ?? null,
      injuryUrl: injury?.url ?? null,
      avgFantasyPoints: player.expectedFptsPerActiveWeek,
      avgPoints: box.pts,
      avgRebounds: box.reb,
      avgAssists: box.ast,
    },
    player.team,
  );
}

export async function loadLockInRoster(query: {
  team?: string | null;
  nbaPersonId?: number | null;
  fullName?: string | null;
}): Promise<LockInRoster | null> {
  const bundle = await loadLockInBundle();
  if (!bundle) {
    return null;
  }
  let team = query.team?.trim().toUpperCase() || "";
  if (!team) {
    const match = findLockInPlayer(bundle.dataset.players, bundle.photoIds, query);
    team = match?.team?.toUpperCase() ?? "";
  }
  if (!team) {
    return null;
  }
  const teamUsage = lockInUsageByTeam(bundle.dataset.players);
  const teammates = lockInTeamPlayers(bundle.dataset.players, team)
    .map((player) => toRosterCard(bundle, player, teamUsage))
    .sort(
      (left, right) =>
        (right.avgFantasyPoints ?? Number.NEGATIVE_INFINITY) -
        (left.avgFantasyPoints ?? Number.NEGATIVE_INFINITY),
    );
  return {
    team,
    teamName: nbaTeamName(team) ?? team,
    season: LOCK_IN_SEASON,
    players: teammates,
    starters: await loadLockInStartingFive(team),
    depthChart: await loadLockInDepthChart(team),
  };
}
