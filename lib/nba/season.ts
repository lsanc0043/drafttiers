export function leagueStartYear(today: Date = new Date()) {
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
}

export function isRookieForLeagueYear(fromYear: number | null | undefined, today: Date = new Date()) {
  return fromYear != null && fromYear === leagueStartYear(today);
}
