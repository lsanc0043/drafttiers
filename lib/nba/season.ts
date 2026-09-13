export function leagueStartYear(today: Date = new Date()) {
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
}

export function isRookieForLeagueYear(fromYear: number | null | undefined, today: Date = new Date()) {
  return fromYear != null && fromYear === leagueStartYear(today);
}

export const FANTASY_AVERAGE_SEASON = "2025-26";

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
