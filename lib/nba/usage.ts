export const USAGE_MIN_GAMES = 15;

export type UsageBox = {
  fieldGoalsAttempted: number;
  freeThrowsAttempted: number;
  turnovers: number;
  minutes: number;
};

function possessions(box: UsageBox) {
  return box.fieldGoalsAttempted + 0.44 * box.freeThrowsAttempted + box.turnovers;
}

export function usageRate(player: UsageBox, team: UsageBox, gamesPlayed: number): number | null {
  if (!Number.isFinite(gamesPlayed) || gamesPlayed <= USAGE_MIN_GAMES) {
    return null;
  }

  const teamPossessions = possessions(team);
  const denominator = player.minutes * teamPossessions;
  if (
    !(player.minutes > 0) ||
    !(team.minutes > 0) ||
    !(teamPossessions > 0) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }

  return (100 * possessions(player) * (team.minutes / 5)) / denominator;
}

export function usageRateFromPerGame(
  player: UsageBox,
  team: UsageBox,
  gamesPlayed: number,
): number | null {
  if (gamesPlayed <= USAGE_MIN_GAMES) {
    return null;
  }
  return usageRate(
    {
      fieldGoalsAttempted: player.fieldGoalsAttempted * gamesPlayed,
      freeThrowsAttempted: player.freeThrowsAttempted * gamesPlayed,
      turnovers: player.turnovers * gamesPlayed,
      minutes: player.minutes * gamesPlayed,
    },
    team,
    gamesPlayed,
  );
}
