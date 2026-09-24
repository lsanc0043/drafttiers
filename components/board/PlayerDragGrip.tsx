"use client";

import { createPortal } from "react-dom";
import { PlayerDragGhost } from "@/components/board/HeldPlayerTray";
import { usePlayerGripDrag } from "@/hooks/usePlayerGripDrag";
import type { PlayerDropDest } from "@/lib/board-drop-target";
import type { PlayerCardData } from "@/components/players/PlayerCard";

export function GripDots({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle cx="5" cy="3" r="1.2" fill="currentColor" />
      <circle cx="11" cy="3" r="1.2" fill="currentColor" />
      <circle cx="5" cy="8" r="1.2" fill="currentColor" />
      <circle cx="11" cy="8" r="1.2" fill="currentColor" />
      <circle cx="5" cy="13" r="1.2" fill="currentColor" />
      <circle cx="11" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function PlayerDragGrip({
  player,
  onDrop,
  compact = false,
}: {
  player: PlayerCardData;
  onDrop?: (player: PlayerCardData, dest: PlayerDropDest) => void;
  compact?: boolean;
}) {
  const { dragPos, gripHandlers } = usePlayerGripDrag(player, onDrop);

  return (
    <>
      <button
        type="button"
        draggable={false}
        aria-label={`Drag ${player.fullName}`}
        className={`touch-none shrink-0 rounded border border-zinc-300 bg-background text-zinc-500 dark:border-zinc-600 dark:text-zinc-400 ${
          compact
            ? "flex h-4 w-4 items-center justify-center"
            : "flex h-7 w-7 items-center justify-center"
        }`}
        data-drop-ignore="true"
        onClick={(event) => event.stopPropagation()}
        {...gripHandlers}
      >
        <GripDots className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>
      {dragPos
        ? createPortal(
            <PlayerDragGhost player={player} x={dragPos.x} y={dragPos.y} />,
            document.body,
          )
        : null}
    </>
  );
}
