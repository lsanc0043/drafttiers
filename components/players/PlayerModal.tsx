"use client";

import { useEffect, useState } from "react";
import { InjuryBadge, type PlayerCardData } from "@/components/players/PlayerCard";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import {
  averageFantasyPoints,
  scoreFantasyGame,
  type FantasyScoring,
} from "@/lib/nba/fantasy";

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
  } | null;
  recentGames: Array<{
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
    fantasyPoints: number;
    doubleDouble: boolean;
    tripleDouble: boolean;
  }>;
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
  const recentGames =
    detail?.recentGames.map((game) => {
      const scored = scoreFantasyGame(game, scoring);
      return { ...game, fantasyPoints: scored.fantasyPoints };
    }) ?? [];
  const seasonFantasyAverage = detail?.seasonFantasy
    ? averageFantasyPoints(detail.seasonFantasy.games, scoring)
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-background p-6 shadow-2xl dark:border-zinc-800"
      >
        {isInjured ? (
          <InjuryBadge className="left-3 top-3" href={injuryUrl} label={injuryLabel} />
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          Close
        </button>
        <div className="flex shrink-0 flex-col items-center text-center">
          <PlayerPhoto
            nbaPersonId={player.nbaPersonId}
            fullName={player.fullName}
            size="modal"
          />
          <h2 id="player-modal-title" className="mt-4 text-2xl font-semibold">
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

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <section className="mt-6 shrink-0 text-left">
          <h3 className="text-sm font-semibold">Season averages</h3>
          {season || seasonFantasyAverage != null ? (
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-zinc-500">Season</dt>
                <dd className="font-medium">{season?.season ?? "2025-26"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">GP</dt>
                <dd className="font-medium">
                  {season?.gamesPlayed ??
                    detail?.seasonFantasy.gamesPlayed ??
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">PTS</dt>
                <dd className="font-medium">{formatStat(season?.points)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">REB</dt>
                <dd className="font-medium">{formatStat(season?.rebounds)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">AST</dt>
                <dd className="font-medium">{formatStat(season?.assists)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">STL</dt>
                <dd className="font-medium">{formatStat(season?.steals)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">BLK</dt>
                <dd className="font-medium">{formatStat(season?.blocks)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">TOV</dt>
                <dd className="font-medium">{formatStat(season?.turnovers)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">FPTS</dt>
                <dd className="font-medium">
                  {seasonFantasyAverage == null
                    ? "—"
                    : formatStat(seasonFantasyAverage)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              {detail ? "No season stats synced yet." : "Loading stats..."}
            </p>
          )}
        </section>

        <section className="mt-6 flex min-h-0 flex-1 flex-col text-left">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Last 10 games</h3>
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
          {recentGames.length ? (
            <div className="mt-2 min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead className="sticky top-0 bg-background text-zinc-500">
                  <tr>
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 font-medium">MIN</th>
                    <th className="py-1 font-medium">PTS</th>
                    <th className="py-1 font-medium">REB</th>
                    <th className="py-1 font-medium">AST</th>
                    <th className="py-1 font-medium">STL</th>
                    <th className="py-1 font-medium">BLK</th>
                    <th className="py-1 font-medium">TOV</th>
                    <th className="py-1 font-medium">3PM</th>
                    <th className="py-1 font-medium">FPTS</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGames.map((game) => (
                    <tr
                      key={game.gameId}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="py-1">{game.gameDate.slice(0, 10)}</td>
                      <td className="py-1">{formatStat(game.minutes, 0)}</td>
                      <td className="py-1">{game.points}</td>
                      <td className="py-1">{game.rebounds}</td>
                      <td className="py-1">{game.assists}</td>
                      <td className="py-1">{game.steals}</td>
                      <td className="py-1">{game.blocks}</td>
                      <td className="py-1">{game.turnovers}</td>
                      <td className="py-1">{game.threePointersMade}</td>
                      <td className="py-1 font-medium">
                        {formatStat(game.fantasyPoints, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              {detail ? "No game logs synced yet." : "Loading games..."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
