"use client";

import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import type { PlayerCardData } from "@/components/players/PlayerCard";

export function HeldPlayerTray({
  player,
  onCancel,
}: {
  player: PlayerCardData;
  onCancel: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 z-[60] flex items-center gap-3 rounded-2xl border border-zinc-200 bg-background px-3 py-2 shadow-xl dark:border-zinc-700"
    >
      <PlayerPhoto
        nbaPersonId={player.nbaPersonId}
        fullName={player.fullName}
        size="compact"
        photoSize={40}
      />
      <p className="min-w-0 flex-1 text-sm">
        <span className="block truncate font-semibold">{player.fullName}</span>
        <span className="block text-zinc-500">Tap a tier to place</span>
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Cancel
      </button>
    </div>
  );
}

export function PlayerDragGhost({
  player,
  x,
  y,
}: {
  player: PlayerCardData;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none fixed z-[100] w-16 -translate-x-1/2 -translate-y-[70%] rounded-lg border border-zinc-900 bg-background px-1 py-1 text-center shadow-2xl dark:border-zinc-100"
      data-drop-ignore="true"
      style={{ left: x, top: y }}
    >
      <PlayerPhoto
        nbaPersonId={player.nbaPersonId}
        fullName={player.fullName}
        size="compact"
        photoSize={40}
      />
      <p className="mt-0.5 truncate text-[10px] font-semibold leading-tight">{player.fullName}</p>
    </div>
  );
}
