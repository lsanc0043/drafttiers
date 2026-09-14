"use client";

import { useEffect, useMemo, useState } from "react";
import {
  InjuryBadge,
  type PlayerCardData,
} from "@/components/players/PlayerCard";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import {
  averageFantasyPoints,
  scoreFantasyGame,
  type FantasyScoring,
} from "@/lib/nba/fantasy";
import {
  defaultGameLogSlice,
  formatGameLogMatchup,
  GAME_LOG_PHASES,
  gameLogBucket,
  gameLogRowClassName,
  gameLogRowTone,
  gameLogSliceKey,
  parseGameLogSliceKey,
} from "@/lib/nba/game-log";
import { GAME_LOG_SEASONS } from "@/lib/nba/season";

type GameLogRow = {
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
  fantasyPoints?: number;
  didNotPlay?: boolean;
  opponentAbbr?: string | null;
};

type PlayerDetailResponse = {
  player: PlayerCardData & { firstName: string; lastName: string };
  seasonStats: {
    season: string;
    gamesPlayed: number;
    minutes: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    usageRate?: number | null;
  } | null;
  recentGames: Array<GameLogRow>;
  gameLog?: Array<GameLogRow>;
  seasonFantasy: {
    season: string;
    gamesPlayed: number;
    averageFantasyPoints: number | null;
    games: Array<{
      points: number;
      rebounds: number;
      assists: number;
      steals: number;
      blocks: number;
      turnovers: number;
      threePointersMade: number;
    }>;
  };
};

type PlayerModalProps = {
  player: PlayerCardData;
  scoring: FantasyScoring;
  onEditScoring?: () => void;
  onClose: () => void;
};

function formatStat(value: number | null | undefined, digits = 1) {
  if (value == null) {
    return "—";
  }
  return value.toFixed(digits);
}

export function PlayerModal({
  player,
  scoring,
  onEditScoring,
  onClose,
}: PlayerModalProps) {
  const [detail, setDetail] = useState<PlayerDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [logSliceChoice, setLogSliceChoice] = useState<{
    playerId: string;
    slice: string;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/players/${player.id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load player stats");
        }
        setDetail((await response.json()) as PlayerDetailResponse);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load player stats",
        );
      });

    return () => controller.abort();
  }, [player.id]);

  async function onRefreshStats() {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const syncResponse = await fetch(
        `/api/admin/nba/players/${player.nbaPersonId}/sync-stats`,
        {
          method: "POST",
        },
      );
      if (!syncResponse.ok) {
        const payload = (await syncResponse.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not refresh stats");
      }
      const detailResponse = await fetch(`/api/players/${player.id}`);
      if (!detailResponse.ok) {
        throw new Error("Could not reload player stats");
      }
      setDetail((await detailResponse.json()) as PlayerDetailResponse);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not refresh stats",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const team = player.teamName ?? player.teamAbbr ?? "Free agent";
  const position = player.position ?? "Unknown";
  const isInjured = detail?.player.isInjured ?? player.isInjured;
  const injuryLabel = detail?.player.injuryLabel ?? player.injuryLabel;
  const injuryUrl = detail?.player.injuryUrl ?? player.injuryUrl;
  const season = detail?.seasonStats;
  const allGames = useMemo(
    () =>
      (detail?.gameLog ?? detail?.recentGames ?? [])
        .filter((game) => gameLogBucket(game.gameId, game.gameDate) != null)
        .map((game) => {
          if (game.didNotPlay) {
            return {
              ...game,
              fantasyPoints: null as number | null,
              didNotPlay: true,
            };
          }
          return {
            ...game,
            didNotPlay: false,
            fantasyPoints: scoreFantasyGame(game, scoring).fantasyPoints,
          };
        }),
    [detail, scoring],
  );

  const logSlice =
    logSliceChoice?.playerId === player.id
      ? logSliceChoice.slice
      : defaultGameLogSlice(allGames);

  const selected = parseGameLogSliceKey(logSlice);
  const seasonGames = allGames.filter((game) => {
    const bucket = gameLogBucket(game.gameId, game.gameDate);
    return (
      bucket != null &&
      selected != null &&
      bucket.season === selected.season &&
      bucket.phase === selected.phase
    );
  });
  const seasonFantasyAverage = averageFantasyPoints(
    allGames.filter((game) => {
      const bucket = gameLogBucket(game.gameId, game.gameDate);
      return !game.didNotPlay && bucket?.season === "2025-26";
    }),
    scoring,
  );
  const visibleFantasyAverage = averageFantasyPoints(
    seasonGames.filter((game) => !game.didNotPlay),
    scoring,
  );
  const hasPlayedGames = allGames.some((game) => !game.didNotPlay);

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close player details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-modal-title"
        className="relative z-10 my-auto flex max-h-[92vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-background p-4 shadow-2xl sm:p-6 dark:border-zinc-800"
      >
        {isInjured ? (
          <InjuryBadge
            className="left-3 top-3"
            href={injuryUrl}
            label={injuryLabel}
          />
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          Close
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pt-6 sm:gap-6 md:flex-row md:overflow-hidden">
          <div className="flex shrink-0 flex-col md:w-[min(22rem,38%)] md:overflow-y-auto">
            <div className="flex flex-col items-center text-center">
              <PlayerPhoto
                nbaPersonId={player.nbaPersonId}
                fullName={player.fullName}
                size="modal"
              />
              <h2
                id="player-modal-title"
                className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl"
              >
                {player.fullName}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {player.isRookie ? (
                  <span>
                    <span className="font-bold text-red-600" title="Rookie">
                      Rookie
                    </span>
                    {" · "}
                  </span>
                ) : null}
                {team} · {position}
              </p>
              <button
                type="button"
                onClick={onRefreshStats}
                disabled={refreshing}
                className="mt-3 rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                {refreshing ? "Refreshing..." : "Refresh Stats"}
              </button>
            </div>

            {error ? (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            ) : null}

            <section className="mt-6 text-left">
              <h3 className="text-sm font-semibold">Season averages</h3>
              {season || seasonFantasyAverage != null ? (
                <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
                  {[
                    { label: "Season", value: season?.season ?? "2025-26" },
                    {
                      label: "GP",
                      value:
                        season?.gamesPlayed ??
                        detail?.seasonFantasy.gamesPlayed ??
                        "—",
                    },
                    { label: "PTS", value: formatStat(season?.points) },
                    { label: "REB", value: formatStat(season?.rebounds) },
                    { label: "AST", value: formatStat(season?.assists) },
                    { label: "STL", value: formatStat(season?.steals) },
                    { label: "BLK", value: formatStat(season?.blocks) },
                    { label: "TOV", value: formatStat(season?.turnovers) },
                    {
                      label: "USG%",
                      value: formatStat(season?.usageRate),
                    },
                    {
                      label: "FPTS",
                      value:
                        seasonFantasyAverage == null
                          ? "—"
                          : seasonFantasyAverage.toFixed(1),
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-zinc-500">{item.label}</dt>
                      <dd className="font-medium">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  {detail ? "No season stats synced yet." : "Loading stats..."}
                </p>
              )}
            </section>
          </div>

          <section className="flex min-w-0 flex-col text-left md:min-h-0 md:flex-1 md:overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Game log</h3>
              {hasPlayedGames ? (
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="game-log-slice">
                    Season and competition
                  </label>
                  <select
                    id="game-log-slice"
                    value={logSlice}
                    onChange={(event) =>
                      setLogSliceChoice({
                        playerId: player.id,
                        slice: event.target.value,
                      })
                    }
                    className="max-w-[16rem] rounded-md border border-zinc-300 bg-background px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    {GAME_LOG_SEASONS.map((seasonId) => (
                      <optgroup key={seasonId} label={seasonId}>
                        {GAME_LOG_PHASES.map((phase) => (
                          <option
                            key={gameLogSliceKey(seasonId, phase.id)}
                            value={gameLogSliceKey(seasonId, phase.id)}
                          >
                            {phase.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {onEditScoring ? (
                    <button
                      type="button"
                      onClick={onEditScoring}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                    >
                      Edit scoring
                    </button>
                  ) : null}
                </div>
              ) : onEditScoring ? (
                <button
                  type="button"
                  onClick={onEditScoring}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                >
                  Edit scoring
                </button>
              ) : null}
            </div>
            {!detail ? (
              <p className="mt-2 text-sm text-zinc-500">Loading games...</p>
            ) : !hasPlayedGames ? (
              <p className="mt-2 text-sm text-zinc-500">
                No games were found for this player.
              </p>
            ) : seasonGames.length ? (
              <div className="mt-2 overflow-x-auto md:min-h-0 md:flex-1 md:overflow-auto">
                <table className="w-full min-w-lg text-left text-sm">
                  <thead className="sticky top-0 bg-background text-zinc-300">
                    <tr>
                      {[
                        "Date",
                        "MIN",
                        "PTS",
                        "REB",
                        "AST",
                        "STL",
                        "BLK",
                        "TOV",
                        "3PM",
                        "FPTS",
                      ].map((header) => (
                        <th
                          key={header}
                          className={`py-2 pr-2 font-medium ${header === "Date" ? "text-left" : "text-center"}`}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seasonGames.map((game) => {
                      const tone = gameLogRowTone(
                        game.fantasyPoints,
                        visibleFantasyAverage,
                        Boolean(game.didNotPlay),
                      );
                      return (
                        <tr
                          key={game.gameId}
                          className="border-t border-zinc-200 dark:border-zinc-800"
                          title={
                            game.didNotPlay
                              ? "Did not play"
                              : visibleFantasyAverage == null
                                ? undefined
                                : `Slice avg FPTS ${visibleFantasyAverage.toFixed(1)}`
                          }
                        >
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {formatGameLogMatchup(
                              game.gameDate,
                              game.opponentAbbr,
                            )}
                          </td>
                          {[
                            formatStat(game.minutes, 0),
                            game.points,
                            game.rebounds,
                            game.assists,
                            game.steals,
                            game.blocks,
                            game.turnovers,
                            game.threePointersMade,
                          ].map((value, index) => (
                            <td key={index} className="py-2 pr-2 text-center">
                              {game.didNotPlay ? "—" : value}
                            </td>
                          ))}
                          <td className="py-2 text-center">
                            {game.didNotPlay ? (
                              "—"
                            ) : (
                              <span className={gameLogRowClassName(tone)}>
                                {formatStat(game.fantasyPoints, 1)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                No games in this season slice.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
