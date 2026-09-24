import type {
  JsonRecord,
  StatdunkAmbiguousField,
  StatdunkLockInDataset,
  StatdunkNormalizedPlayer,
  StatdunkSourceMeta,
  StatdunkSourceName,
} from "@/lib/statdunk/types";

export const STATDUNK_AMBIGUOUS_FIELDS: StatdunkAmbiguousField[] = [
  {
    path: "nbaPersonId",
    note: "Neither endpoint returned an NBA person/player ID. teamIdAtCutoff looks like an NBA team ID, not a player ID.",
  },
  {
    path: "usage",
    note: "No usage or USG field appeared on either endpoint.",
  },
  {
    path: "lockIn.liDelta",
    note: "Present on lockIn but the API does not define the unit or baseline.",
  },
  {
    path: "projectedStats.qd / expectedSelectedStats.qd",
    note: "Abbreviation is not labeled. Nearby fields include dd and td.",
  },
  {
    path: "projectedStats.pf / expectedSelectedStats.pf",
    note: "Not labeled. Could be personal fouls; kept as pf.",
  },
  {
    path: "lockIn.expectedLockedInTotal vs projectedTotalFpts vs p50LockedInTotal",
    note: "All three totals are present and differ. Original names are preserved.",
  },
  {
    path: "fptsPercentiles",
    note: "Table payload maps sleeperPlayerId strings to numbers. The API does not label the number as a percentile rank, FPTS value, or something else.",
  },
  {
    path: "teamIdAtCutoff",
    note: "Preserved as nbaTeamId. Cutoff is not defined by the API.",
  },
  {
    path: "rateSource / fallback / lockIn.profileFallback",
    note: "Internal model flags; meanings are not documented in the payload.",
  },
];

function asRecord(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((part) => asString(part)).filter((part): part is string => part != null);
}

export function extractPlayers(payload: unknown): JsonRecord[] {
  const root = asRecord(payload);
  const candidates = [
    root?.release && asRecord(root.release)?.players,
    root?.players,
    root?.data,
    root?.rows,
    payload,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(asRecord).filter((row): row is JsonRecord => row != null);
    }
  }
  return [];
}

export function extractPublication(payload: unknown): JsonRecord | null {
  const root = asRecord(payload);
  const release = asRecord(root?.release);
  return asRecord(release?.publication) ?? asRecord(root?.publication);
}

export function extractAccess(payload: unknown): JsonRecord | null {
  return asRecord(asRecord(payload)?.access);
}

export function extractFptsPercentiles(payload: unknown): Record<string, unknown> | null {
  const release = asRecord(asRecord(payload)?.release);
  const value = release?.fptsPercentiles;
  return asRecord(value);
}

export function nextPageUrl(payload: unknown, currentUrl: string, page: number): string | null {
  const root = asRecord(payload);
  const direct =
    asString(root?.next) ??
    asString(asRecord(root?.links)?.next) ??
    asString(asRecord(root?.pagination)?.next);
  if (direct) {
    return direct;
  }

  const access = extractAccess(payload);
  const previewLimit = asNumber(access?.previewLimit);
  const totalPlayerCount = asNumber(access?.totalPlayerCount);
  const players = extractPlayers(payload);
  if (
    previewLimit != null &&
    totalPlayerCount != null &&
    players.length >= previewLimit &&
    players.length < totalPlayerCount
  ) {
    return null;
  }

  const totalPages = asNumber(root?.totalPages) ?? asNumber(asRecord(root?.pagination)?.totalPages);
  if (totalPages != null && page < totalPages) {
    const url = new URL(currentUrl);
    url.searchParams.set("page", String(page + 1));
    return url.toString();
  }

  const hasMore = root?.hasMore === true || asRecord(root?.pagination)?.hasMore === true;
  if (hasMore) {
    const url = new URL(currentUrl);
    url.searchParams.set("page", String(page + 1));
    return url.toString();
  }

  return null;
}

function lockInRecord(player: JsonRecord): JsonRecord | null {
  return asRecord(player.lockIn);
}

function pointsRanks(player: JsonRecord): JsonRecord | null {
  return asRecord(player.pointsRanks);
}

export function normalizePlayer(
  player: JsonRecord,
  extras?: {
    source: StatdunkSourceName;
    tableFptsPercentile?: number | null;
    otherOriginal?: JsonRecord | null;
  },
): StatdunkNormalizedPlayer {
  const lockIn = lockInRecord(player);
  const ranks = pointsRanks(player);
  const positions = asStringList(player.fantasyPositions);
  const source = extras?.source ?? "v3LockIn";
  const originalV3 = source === "v3LockIn" ? player : extras?.otherOriginal ?? null;
  const originalTable = source === "projectionTable" ? player : extras?.otherOriginal ?? null;

  return {
    playerName: asString(player.displayName),
    nbaPersonId: asString(player.nbaPersonId) ?? asString(player.nbaId) ?? asString(player.nba_id),
    nbaTeamId: asString(player.teamIdAtCutoff),
    sleeperPlayerId: asString(player.sleeperPlayerId),
    canonicalPlayerId: asString(player.canonicalPlayerId),
    team: asString(player.teamAbbreviation),
    position: positions.join("/") || null,
    fantasyPositions: positions,
    gamesPlayed: asNumber(player.projectedGames) ?? asNumber(lockIn?.projectedGames),
    minutes: asNumber(player.projectedMinutes) ?? asNumber(asRecord(player.projectedStats)?.min),
    usage: asNumber(player.usage) ?? asNumber(player.usg) ?? asNumber(asRecord(player.projectedStats)?.usg),
    fantasyPoints: asNumber(player.projectedTotalFpts) ?? asNumber(lockIn?.projectedTotalFpts),
    fantasyPointsPerGame: asNumber(player.projectedFptsPerGame),
    pointsRankTotals: asNumber(ranks?.totals),
    pointsRankAverages: asNumber(ranks?.averages),
    lockInTotalRank: asNumber(lockIn?.totalRank),
    lockInAverageRank: asNumber(lockIn?.averageRank),
    lockInRegularPerGameRank: asNumber(lockIn?.regularPerGameRank),
    lockInExpectedTotal: asNumber(lockIn?.expectedLockedInTotal),
    lockInP10Total: asNumber(lockIn?.p10LockedInTotal),
    lockInP50Total: asNumber(lockIn?.p50LockedInTotal),
    lockInP90Total: asNumber(lockIn?.p90LockedInTotal),
    lockInLiDelta: asNumber(lockIn?.liDelta),
    expectedFptsPerActiveWeek: asNumber(lockIn?.expectedFptsPerActiveWeek),
    expectedFptsPerActiveWeekRank: null,
    tableFptsPercentile: extras?.tableFptsPercentile ?? null,
    sources: extras?.otherOriginal ? ["v3LockIn", "projectionTable"] : [source],
    original: {
      v3LockIn: originalV3,
      projectionTable: originalTable,
    },
  };
}

function playerKey(player: JsonRecord): string {
  return (
    asString(player.canonicalPlayerId) ??
    asString(player.sleeperPlayerId) ??
    asString(player.displayName) ??
    JSON.stringify(player)
  );
}

export function mergeStatdunkPlayers(input: {
  v3Players: JsonRecord[];
  tablePlayers: JsonRecord[];
  fptsPercentiles: Record<string, unknown> | null;
}): StatdunkNormalizedPlayer[] {
  const tableByCanonical = new Map<string, JsonRecord>();
  const tableBySleeper = new Map<string, JsonRecord>();
  for (const player of input.tablePlayers) {
    const canonical = asString(player.canonicalPlayerId);
    const sleeper = asString(player.sleeperPlayerId);
    if (canonical) {
      tableByCanonical.set(canonical, player);
    }
    if (sleeper) {
      tableBySleeper.set(sleeper, player);
    }
  }

  const seen = new Set<string>();
  const merged: StatdunkNormalizedPlayer[] = [];

  for (const player of input.v3Players) {
    const key = playerKey(player);
    seen.add(key);
    const sleeper = asString(player.sleeperPlayerId);
    const tableMatch =
      (asString(player.canonicalPlayerId)
        ? tableByCanonical.get(asString(player.canonicalPlayerId) ?? "")
        : undefined) ?? (sleeper ? tableBySleeper.get(sleeper) : undefined);
    const percentileRaw = sleeper && input.fptsPercentiles ? input.fptsPercentiles[sleeper] : undefined;
    merged.push(
      normalizePlayer(player, {
        source: "v3LockIn",
        otherOriginal: tableMatch ?? null,
        tableFptsPercentile: asNumber(percentileRaw),
      }),
    );
  }

  for (const player of input.tablePlayers) {
    const key = playerKey(player);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const sleeper = asString(player.sleeperPlayerId);
    const percentileRaw = sleeper && input.fptsPercentiles ? input.fptsPercentiles[sleeper] : undefined;
    merged.push(
      normalizePlayer(player, {
        source: "projectionTable",
        tableFptsPercentile: asNumber(percentileRaw),
      }),
    );
  }

  return rankByExpectedFptsPerActiveWeek(merged);
}

function rankByExpectedFptsPerActiveWeek(players: StatdunkNormalizedPlayer[]): StatdunkNormalizedPlayer[] {
  const ordered = [...players].sort((left, right) => {
    const leftWeek = left.expectedFptsPerActiveWeek;
    const rightWeek = right.expectedFptsPerActiveWeek;
    if (leftWeek == null && rightWeek == null) {
      return (left.playerName ?? "").localeCompare(right.playerName ?? "");
    }
    if (leftWeek == null) {
      return 1;
    }
    if (rightWeek == null) {
      return -1;
    }
    return rightWeek - leftWeek || (left.playerName ?? "").localeCompare(right.playerName ?? "");
  });

  let lastValue: number | null = null;
  let lastRank = 0;
  return ordered.map((player, index) => {
    const value = player.expectedFptsPerActiveWeek;
    if (value == null) {
      return { ...player, expectedFptsPerActiveWeekRank: null };
    }
    if (lastValue == null || value !== lastValue) {
      lastRank = index + 1;
      lastValue = value;
    }
    return { ...player, expectedFptsPerActiveWeekRank: lastRank };
  });
}

export function buildLockInDataset(input: {
  scrapedAt?: string;
  v3Payload: unknown;
  tablePayload: unknown;
  v3Meta: StatdunkSourceMeta;
  tableMeta: StatdunkSourceMeta;
}): StatdunkLockInDataset {
  const v3Players = extractPlayers(input.v3Payload);
  const tablePlayers = extractPlayers(input.tablePayload);
  const fptsPercentiles = extractFptsPercentiles(input.tablePayload);
  return {
    scrapedAt: input.scrapedAt ?? new Date().toISOString(),
    joinKeys: ["canonicalPlayerId", "sleeperPlayerId"],
    ambiguousFields: STATDUNK_AMBIGUOUS_FIELDS,
    sources: [input.v3Meta, input.tableMeta],
    publication: extractPublication(input.v3Payload) ?? extractPublication(input.tablePayload),
    fptsPercentiles,
    players: mergeStatdunkPlayers({ v3Players, tablePlayers, fptsPercentiles }),
  };
}

export function csvEscape(value: unknown): string {
  if (value == null) {
    return "";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export function datasetToCsv(dataset: StatdunkLockInDataset): string {
  const headers = [
    "playerName",
    "nbaPersonId",
    "nbaTeamId",
    "sleeperPlayerId",
    "canonicalPlayerId",
    "team",
    "position",
    "gamesPlayed",
    "minutes",
    "usage",
    "fantasyPoints",
    "fantasyPointsPerGame",
    "pointsRankTotals",
    "pointsRankAverages",
    "lockInTotalRank",
    "lockInAverageRank",
    "lockInRegularPerGameRank",
    "lockInExpectedTotal",
    "lockInP10Total",
    "lockInP50Total",
    "lockInP90Total",
    "lockInLiDelta",
    "expectedFptsPerActiveWeek",
    "expectedFptsPerActiveWeekRank",
    "tableFptsPercentile",
    "sources",
    "originalV3LockIn",
    "originalProjectionTable",
  ];
  const rows = dataset.players.map((player) =>
    [
      player.playerName,
      player.nbaPersonId,
      player.nbaTeamId,
      player.sleeperPlayerId,
      player.canonicalPlayerId,
      player.team,
      player.position,
      player.gamesPlayed,
      player.minutes,
      player.usage,
      player.fantasyPoints,
      player.fantasyPointsPerGame,
      player.pointsRankTotals,
      player.pointsRankAverages,
      player.lockInTotalRank,
      player.lockInAverageRank,
      player.lockInRegularPerGameRank,
      player.lockInExpectedTotal,
      player.lockInP10Total,
      player.lockInP50Total,
      player.lockInP90Total,
      player.lockInLiDelta,
      player.expectedFptsPerActiveWeek,
      player.expectedFptsPerActiveWeekRank,
      player.tableFptsPercentile,
      player.sources.join("|"),
      player.original.v3LockIn,
      player.original.projectionTable,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
