import { GAME_LOG_SEASONS, isGameLogSeason, type GameLogSeason } from "@/lib/nba/season";

export type GameLogPhase = "preseason" | "regular" | "playin" | "postseason";

export const GAME_LOG_PHASES: Array<{ id: GameLogPhase; label: string }> = [
  { id: "preseason", label: "Preseason" },
  { id: "regular", label: "Regular season" },
  { id: "playin", label: "Play-in" },
  { id: "postseason", label: "Postseason" },
];

export function gameLogSliceKey(season: GameLogSeason, phase: GameLogPhase) {
  return `${season}:${phase}`;
}

export function parseGameLogSliceKey(value: string): {
  season: GameLogSeason;
  phase: GameLogPhase;
} | null {
  const [season, phase] = value.split(":");
  if (!season || !isGameLogSeason(season)) {
    return null;
  }
  if (
    phase !== "preseason" &&
    phase !== "regular" &&
    phase !== "playin" &&
    phase !== "postseason"
  ) {
    return null;
  }
  return { season, phase };
}

export function nbaSeasonFromGameId(gameId: string): string | null {
  const digits = gameId.replace(/\D/g, "").padStart(10, "0");
  if (digits.length < 10) {
    return null;
  }
  const yearCode = Number(digits.slice(3, 5));
  if (!Number.isInteger(yearCode)) {
    return null;
  }
  const startYear = yearCode >= 40 ? 1900 + yearCode : 2000 + yearCode;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function gameLogPhaseFromGameId(gameId: string): GameLogPhase | null {
  const digits = gameId.replace(/\D/g, "").padStart(10, "0");
  if (digits.length < 10) {
    return null;
  }
  switch (digits[2]) {
    case "1":
      return "preseason";
    case "2":
      return "regular";
    case "4":
      return "postseason";
    case "5":
      return "playin";
    default:
      return null;
  }
}

export function gameLogBucket(
  gameId: string,
  gameDate: string,
): { season: GameLogSeason; phase: GameLogPhase } | null {
  const fromId = nbaSeasonFromGameId(gameId);
  const season =
    fromId && isGameLogSeason(fromId)
      ? fromId
      : seasonFromIsoDate(gameDate);
  if (!season) {
    return null;
  }
  const phase = gameLogPhaseFromGameId(gameId) ?? "regular";
  return { season, phase };
}

function seasonFromIsoDate(gameDate: string): GameLogSeason | null {
  const year = Number(gameDate.slice(0, 4));
  const month = Number(gameDate.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }
  const startYear = month >= 7 ? year : year - 1;
  const season = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  return isGameLogSeason(season) ? season : null;
}

export function defaultGameLogSlice(
  games: Array<{ gameId: string; gameDate: string }>,
) {
  const preferred = gameLogSliceKey("2025-26", "regular");
  const keys = new Set(
    games
      .map((game) => gameLogBucket(game.gameId, game.gameDate))
      .filter((bucket): bucket is NonNullable<typeof bucket> => bucket != null)
      .map((bucket) => gameLogSliceKey(bucket.season, bucket.phase)),
  );
  if (keys.has(preferred)) {
    return preferred;
  }
  for (const season of GAME_LOG_SEASONS) {
    const regular = gameLogSliceKey(season, "regular");
    if (keys.has(regular)) {
      return regular;
    }
  }
  return preferred;
}

export type SeasonGameEntry = {
  gameId: string;
  gameDate: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threePointersMade: number;
  didNotPlay: boolean;
  opponentAbbr?: string | null;
};

export type TeamGameEntry = {
  gameId: string;
  gameDate: string;
  opponentAbbr?: string | null;
};

export type TeamGameCount = {
  teamId: number;
  season: string;
  games: number;
};

export function likelySeasonTeams(
  counts: TeamGameCount[],
  options?: {
    currentTeamId?: number | null;
    seasons?: readonly string[];
  },
): Array<{ teamId: number; season: string }> {
  const maxBySeason = new Map<string, number>();
  for (const row of counts) {
    const games = Number(row.games) || 0;
    maxBySeason.set(row.season, Math.max(maxBySeason.get(row.season) ?? 0, games));
  }

  const selected = new Map<string, { teamId: number; season: string }>();
  function add(teamId: number, season: string) {
    if (!Number.isInteger(teamId) || teamId <= 0 || !season) {
      return;
    }
    selected.set(`${teamId}:${season}`, { teamId, season });
  }

  for (const row of counts) {
    const games = Number(row.games) || 0;
    const max = maxBySeason.get(row.season) ?? 0;
    if (games <= 0 || max <= 0) {
      continue;
    }
    if (games === max || (games > 7 && games >= max * 0.3)) {
      add(Number(row.teamId), row.season);
    }
  }

  const currentTeamId = options?.currentTeamId;
  if (currentTeamId != null) {
    const seasons = options?.seasons?.length ? options.seasons : [...maxBySeason.keys()];
    for (const season of seasons) {
      add(currentTeamId, season);
    }
  }

  return [...selected.values()];
}

const EMPTY_BOX = {
  minutes: 0,
  points: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  threePointersMade: 0,
};

export function mergeSeasonGameLog(
  playerGames: Array<
    Omit<SeasonGameEntry, "didNotPlay"> & { didNotPlay?: boolean }
  >,
  teamGames: TeamGameEntry[],
): SeasonGameEntry[] {
  const byId = new Map<string, SeasonGameEntry>();

  for (const game of playerGames) {
    byId.set(game.gameId, { ...game, didNotPlay: false });
  }

  if (teamGames.length === 0) {
    return [...byId.values()].sort((left, right) =>
      right.gameDate.localeCompare(left.gameDate),
    );
  }

  return teamGames
    .map((teamGame) => {
      const played = byId.get(teamGame.gameId);
      if (played) {
        return {
          ...played,
          opponentAbbr: teamGame.opponentAbbr ?? played.opponentAbbr,
          didNotPlay: false,
        };
      }
      return {
        gameId: teamGame.gameId,
        gameDate: teamGame.gameDate,
        ...EMPTY_BOX,
        opponentAbbr: teamGame.opponentAbbr,
        didNotPlay: true,
      };
    })
    .sort((left, right) => right.gameDate.localeCompare(left.gameDate));
}

export function formatGameLogMatchup(
  gameDate: string,
  opponentAbbr?: string | null,
) {
  const iso = gameDate.slice(0, 10);
  const parts = iso.split("-");
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date =
    Number.isInteger(month) && Number.isInteger(day) && month > 0 && day > 0
      ? `${month}/${day}`
      : iso;
  const opponent = opponentAbbr?.trim().toUpperCase();
  return opponent ? `${date} vs ${opponent}` : date;
}

export const GAME_LOG_FPTS_GREEN_BELOW = 5;
export const GAME_LOG_FPTS_YELLOW_BELOW = 15;

function toneFromDelta(
  delta: number,
  greenBelow: number,
  yellowBelow: number,
): "above" | "average" | "below" {
  if (delta >= -greenBelow) {
    return "above";
  }
  if (delta >= -yellowBelow) {
    return "average";
  }
  return "below";
}

function scaledBands(statAverage: number, fptsAverage: number | null | undefined) {
  const reference =
    fptsAverage != null && Number.isFinite(fptsAverage) && fptsAverage > 0
      ? fptsAverage
      : statAverage > 0
        ? statAverage
        : 1;
  const scale = statAverage > 0 ? statAverage / reference : 0;
  return {
    greenBelow: GAME_LOG_FPTS_GREEN_BELOW * scale,
    yellowBelow: GAME_LOG_FPTS_YELLOW_BELOW * scale,
  };
}

export function gameLogRowTone(
  value: number | null,
  average: number | null,
  didNotPlay: boolean,
): "dnp" | "above" | "average" | "below" | null {
  if (didNotPlay) {
    return "dnp";
  }
  if (
    value == null ||
    average == null ||
    !Number.isFinite(value) ||
    !Number.isFinite(average)
  ) {
    return null;
  }
  return toneFromDelta(
    value - average,
    GAME_LOG_FPTS_GREEN_BELOW,
    GAME_LOG_FPTS_YELLOW_BELOW,
  );
}

export function gameLogStatTone(
  value: number | null,
  average: number | null,
  didNotPlay: boolean,
  invert = false,
  fptsAverage?: number | null,
) {
  if (didNotPlay) {
    return "dnp";
  }
  if (
    value == null ||
    average == null ||
    !Number.isFinite(value) ||
    !Number.isFinite(average)
  ) {
    return null;
  }
  const { greenBelow, yellowBelow } = scaledBands(average, fptsAverage);
  const delta = invert ? average - value : value - average;
  return toneFromDelta(delta, greenBelow, yellowBelow);
}

export function gameLogRowClassName(tone: ReturnType<typeof gameLogRowTone>) {
  const badge = "inline-block rounded px-2 py-0.5 text-sm font-bold tracking-wide text-black";
  switch (tone) {
    case "dnp":
      return `${badge} bg-[#CFCFC4]`;
    case "above":
      return `${badge} bg-[#77DD77]`;
    case "average":
      return `${badge} bg-[#FDFD96]`;
    case "below":
      return `${badge} bg-[#FF6961]`;
    default:
      return badge;
  }
}
