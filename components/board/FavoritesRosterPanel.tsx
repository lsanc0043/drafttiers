"use client";

import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import type { BoardBucketPlayer } from "@/types";
import type { FavoriteLineupEvaluation } from "@/lib/sleeper/roster";

type FavoritesRosterPanelProps = {
  favorites: BoardBucketPlayer[];
  evaluation: FavoriteLineupEvaluation;
  onSelect: (player: BoardBucketPlayer) => void;
  onClear?: () => void;
};

const STATUS_CLASS: Record<FavoriteLineupEvaluation["status"], string> = {
  empty: "text-zinc-500",
  incomplete: "text-amber-600 dark:text-amber-400",
  legal: "text-emerald-600 dark:text-emerald-400",
  illegal: "text-red-600 dark:text-red-400",
};

const STATUS_LABEL: Record<FavoriteLineupEvaluation["status"], string> = {
  empty: "No favorites",
  incomplete: "Incomplete",
  legal: "Legal team",
  illegal: "Not legal",
};

export function FavoritesRosterPanel({
  favorites,
  evaluation,
  onSelect,
  onClear,
}: FavoritesRosterPanelProps) {
  const filledSlots = evaluation.assignment.filter((slot) => slot.label);
  const preview =
    filledSlots.length > 0
      ? filledSlots
          .slice(0, 5)
          .map((slot) => `${slot.position} ${slot.label}`)
          .join(" · ")
      : favorites.length > 0
        ? favorites
            .slice(0, 5)
            .map((player) => player.fullName)
            .join(" · ")
        : "Star chips to build a sample roster";

  return (
    <details className="group rounded-xl border border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-sm font-semibold tracking-wide">Favorites</h2>
            <p className={`text-sm ${STATUS_CLASS[evaluation.status]}`}>
              {STATUS_LABEL[evaluation.status]}
              <span className="text-zinc-500">
                {` · ${evaluation.startersFilled}/${evaluation.starterSpots} starters · ${favorites.length}/${evaluation.rosterSpots} roster`}
              </span>
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {evaluation.missingPositions.length > 0
              ? `Need ${evaluation.missingPositions.join(", ")}`
              : preview}
          </p>
        </div>
        {onClear && favorites.length > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClear();
            }}
            className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear
          </button>
        ) : null}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">{evaluation.summary}</p>
        {evaluation.usingDefaultSlots ? (
          <p className="mt-1 text-xs text-zinc-400">
            Roster: 1 PG, 1 SG, 1 G, 1 SF, 1 PF, 1 F, 1 C, 2 UTIL, 4 BN.
          </p>
        ) : null}

        {favorites.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Star a player chip to add them here and check the lineup against roster needs.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {favorites.map((player) => (
              <li key={player.playerId}>
                <button
                  type="button"
                  onClick={() => onSelect(player)}
                  className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-left text-sm hover:border-amber-400 dark:border-amber-700 dark:bg-amber-950/40"
                >
                  <PlayerPhoto
                    nbaPersonId={player.nbaPersonId}
                    fullName={player.fullName}
                    size="compact"
                    photoSize={28}
                  />
                  <span className="font-medium">{player.fullName}</span>
                  <span className="text-xs text-zinc-500">{player.position ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {evaluation.assignment.map((slot) => (
            <div
              key={slot.slotId}
              className={`rounded-md border px-2 py-1.5 text-sm ${
                slot.playerId
                  ? "border-zinc-200 dark:border-zinc-800"
                  : "border-dashed border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {slot.position}
              </p>
              <p className={slot.label ? "truncate font-medium" : "text-zinc-400"}>
                {slot.label ?? "Open"}
              </p>
            </div>
          ))}
        </div>

        {evaluation.overflow.length > 0 ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Over roster: {evaluation.overflow.map((player) => player.label).join(", ")}
          </p>
        ) : null}
      </div>
    </details>
  );
}
