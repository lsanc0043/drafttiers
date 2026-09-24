export function leagueStartYear(today: Date = new Date()) {
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
}

export function isRookieForLeagueYear(fromYear: number | null | undefined, today: Date = new Date()) {
  return fromYear != null && fromYear === leagueStartYear(today);
}

export const FANTASY_AVERAGE_SEASON = "2025-26";
export const LOCK_IN_SEASON = "2026-27";
export const GAME_LOG_SEASONS = ["2025-26", "2026-27"] as const;
export type GameLogSeason = (typeof GAME_LOG_SEASONS)[number];

export function isGameLogSeason(value: string): value is GameLogSeason {
  return (GAME_LOG_SEASONS as readonly string[]).includes(value);
}

export function gameLogDateRange() {
  return {
    start: seasonDateRange(GAME_LOG_SEASONS[0]).start,
    end: seasonDateRange(GAME_LOG_SEASONS[GAME_LOG_SEASONS.length - 1]).end,
  };
}

export function seasonDateRange(season: string = FANTASY_AVERAGE_SEASON) {
  const startYear = Number(season.split("-")[0]);
  if (!Number.isFinite(startYear)) {
    throw new Error(`Invalid NBA season: ${season}`);
  }

  return {
    start: new Date(Date.UTC(startYear, 6, 1)),
    end: new Date(Date.UTC(startYear + 1, 6, 1)),
  };
}
