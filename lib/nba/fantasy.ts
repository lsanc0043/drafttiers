export type FantasyScoring = {
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  doubleDouble: number;
  turnover: number;
  threePointer: number;
  tripleDouble: number;
  technical: number;
  flagrant: number;
  points40: number;
  points50: number;
};

export const DEFAULT_FANTASY_SCORING: FantasyScoring = {
  points: 1,
  rebounds: 1,
  assists: 2,
  blocks: 4,
  steals: 4,
  doubleDouble: 2,
  turnover: -2,
  threePointer: 1,
  tripleDouble: 4,
  technical: -2,
  flagrant: -2,
  points40: 0,
  points50: 0,
};

export const FANTASY_SCORING_FIELDS: Array<{
  key: keyof FantasyScoring;
  label: string;
  hint?: string;
}> = [
  { key: "points", label: "PTS" },
  { key: "rebounds", label: "REB" },
  { key: "assists", label: "AST" },
  { key: "blocks", label: "BLK" },
  { key: "steals", label: "STL" },
  { key: "doubleDouble", label: "DD" },
  { key: "turnover", label: "TOV" },
  { key: "threePointer", label: "FG3M" },
  { key: "tripleDouble", label: "TD" },
  { key: "technical", label: "TF", hint: "Not in synced game logs yet" },
  { key: "flagrant", label: "FF", hint: "Not in synced game logs yet" },
  { key: "points40", label: "40-point bonus" },
  { key: "points50", label: "50-point bonus" },
];

export type FantasyBoxScore = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threePointersMade: number;
};

const TEN_CAT_KEYS = ["points", "rebounds", "assists", "steals", "blocks"] as const;

export function tenCategoryCount(box: FantasyBoxScore) {
  return TEN_CAT_KEYS.filter((key) => box[key] >= 10).length;
}

export function scoringToForm(scoring: FantasyScoring): Record<keyof FantasyScoring, string> {
  return {
    points: String(scoring.points),
    rebounds: String(scoring.rebounds),
    assists: String(scoring.assists),
    blocks: String(scoring.blocks),
    steals: String(scoring.steals),
    doubleDouble: String(scoring.doubleDouble),
    turnover: String(scoring.turnover),
    threePointer: String(scoring.threePointer),
    tripleDouble: String(scoring.tripleDouble),
    technical: String(scoring.technical),
    flagrant: String(scoring.flagrant),
    points40: String(scoring.points40),
    points50: String(scoring.points50),
  };
}

export function parseFantasyScoring(value: unknown): FantasyScoring {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_FANTASY_SCORING };
  }

  const input = value as Record<string, unknown>;
  const next = { ...DEFAULT_FANTASY_SCORING };

  for (const key of Object.keys(DEFAULT_FANTASY_SCORING) as Array<keyof FantasyScoring>) {
    const parsed = Number(input[key]);
    if (Number.isFinite(parsed)) {
      next[key] = parsed;
    }
  }

  return next;
}

export function scoreFantasyGame(box: FantasyBoxScore, scoring: FantasyScoring = DEFAULT_FANTASY_SCORING) {
  const tens = tenCategoryCount(box);
  const doubleDouble = tens >= 2;
  const tripleDouble = tens >= 3;

  const comboBonus = tripleDouble
    ? scoring.tripleDouble
    : doubleDouble
      ? scoring.doubleDouble
      : 0;

  let milestoneBonus = 0;
  if (box.points >= 50) {
    milestoneBonus += scoring.points50;
  } else if (box.points >= 40) {
    milestoneBonus += scoring.points40;
  }

  const fantasyPoints =
    box.points * scoring.points +
    box.rebounds * scoring.rebounds +
    box.assists * scoring.assists +
    box.blocks * scoring.blocks +
    box.steals * scoring.steals +
    box.turnovers * scoring.turnover +
    box.threePointersMade * scoring.threePointer +
    comboBonus +
    milestoneBonus;

  return {
    fantasyPoints,
    doubleDouble,
    tripleDouble,
  };
}

export function averageFantasyPoints(games: FantasyBoxScore[], scoring: FantasyScoring = DEFAULT_FANTASY_SCORING) {
  if (games.length === 0) {
    return null;
  }

  const total = games.reduce((sum, game) => sum + scoreFantasyGame(game, scoring).fantasyPoints, 0);
  return total / games.length;
}

export const FANTASY_LIMITATIONS = [
  "Technical fouls (TF) and flagrant fouls (FF) are not in LeagueGameLog / PlayerGameLog, so those values are stored but not applied.",
] as const;
