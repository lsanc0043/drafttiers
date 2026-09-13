"use client";

import { useEffect } from "react";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import type { PlayerCardData } from "@/components/players/PlayerCard";

type PlayerModalProps = {
  player: PlayerCardData;
  onClose: () => void;
};

export function PlayerModal({ player, onClose }: PlayerModalProps) {
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

  const team = player.teamName ?? player.teamAbbr ?? "Free agent";
  const position = player.position ?? "Unknown";

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
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-background p-6 shadow-2xl dark:border-zinc-800"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          Close
        </button>
        <div className="flex flex-col items-center text-center">
          <PlayerPhoto nbaPersonId={player.nbaPersonId} fullName={player.fullName} size="modal" />
          <h2 id="player-modal-title" className="mt-4 text-2xl font-semibold">
            {player.fullName}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {team} · {position}
            {player.isRookie ? (
              <span className="ml-1 font-bold text-red-600" title="Rookie">
                R
              </span>
            ) : null}
          </p>
          <dl className="mt-6 grid w-full grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">Jersey</dt>
              <dd className="font-medium">{player.jerseyNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="font-medium">{player.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-zinc-500">NBA ID</dt>
              <dd className="font-medium">{player.nbaPersonId}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
