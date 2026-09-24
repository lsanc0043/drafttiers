export type JsonRecord = Record<string, unknown>;

export type StatdunkSourceName = "v3LockIn" | "projectionTable";

export type StatdunkAmbiguousField = {
  path: string;
  note: string;
};

export type StatdunkSourceMeta = {
  name: StatdunkSourceName;
  url: string;
  playerCount: number;
  totalPlayerCount: number | null;
  previewLimited: boolean;
  publication: JsonRecord | null;
  access: JsonRecord | null;
};

export type StatdunkNormalizedPlayer = {
  playerName: string | null;
  nbaPersonId: string | null;
  nbaTeamId: string | null;
  sleeperPlayerId: string | null;
  canonicalPlayerId: string | null;
  team: string | null;
  position: string | null;
  fantasyPositions: string[];
  gamesPlayed: number | null;
  minutes: number | null;
  usage: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGame: number | null;
  pointsRankTotals: number | null;
  pointsRankAverages: number | null;
  lockInTotalRank: number | null;
  lockInAverageRank: number | null;
  lockInRegularPerGameRank: number | null;
  lockInExpectedTotal: number | null;
  lockInP10Total: number | null;
  lockInP50Total: number | null;
  lockInP90Total: number | null;
  lockInLiDelta: number | null;
  expectedFptsPerActiveWeek: number | null;
  expectedFptsPerActiveWeekRank: number | null;
  tableFptsPercentile: number | null;
  sources: StatdunkSourceName[];
  original: {
    v3LockIn: JsonRecord | null;
    projectionTable: JsonRecord | null;
  };
};

export type StatdunkLockInDataset = {
  scrapedAt: string;
  joinKeys: string[];
  ambiguousFields: StatdunkAmbiguousField[];
  sources: StatdunkSourceMeta[];
  publication: JsonRecord | null;
  fptsPercentiles: Record<string, unknown> | null;
  players: StatdunkNormalizedPlayer[];
};
