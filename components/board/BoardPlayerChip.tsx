"use client";

import { useRef, useState, type DragEvent } from "react";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import {
  peekDraggingPlayer,
  setDraggingPlayer,
  takeDraggingPlayer,
  type PlayerCardData,
} from "@/components/players/PlayerCard";
import type { BoardBucketPlayer } from "@/types";

type InsertSide = "before" | "after";

type BoardPlayerChipProps = {
  player: BoardBucketPlayer;
  selected?: boolean;
  selecting?: boolean;
  onSelect: () => void;
  onToggleSelect?: () => void;
  onRemove?: () => void;
  onDropRelative?: (player: PlayerCardData, side: InsertSide) => void;
};

export function BoardPlayerChip({
  player,
  selected = false,
  selecting = false,
  onSelect,
  onToggleSelect,
  onRemove,
  onDropRelative,
}: BoardPlayerChipProps) {
  const didDrag = useRef(false);
  const [insertSide, setInsertSide] = useState<InsertSide | null>(null);

  function onDragStart(event: DragEvent<HTMLButtonElement>) {
    didDrag.current = true;
    const card: PlayerCardData = {
      id: player.playerId,
      nbaPersonId: player.nbaPersonId,
      fullName: player.fullName,
      teamAbbr: player.teamAbbr,
      teamName: player.teamName,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      isActive: player.isActive,
      isRookie: false,
    };
    setDraggingPlayer(card);
    event.dataTransfer.setData("text/plain", JSON.stringify(card));
    event.dataTransfer.effectAllowed = "move";
  }

  function onWrapperDragOver(event: DragEvent<HTMLDivElement>) {
    if (!onDropRelative) {
      return;
    }
    const dragging = peekDraggingPlayer();
    if (!dragging || dragging.id === player.playerId) {
      setInsertSide(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const box = event.currentTarget.getBoundingClientRect();
    setInsertSide(event.clientX < box.left + box.width / 2 ? "before" : "after");
  }

  function onWrapperDragLeave(event: DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setInsertSide(null);
  }

  function onWrapperDrop(event: DragEvent<HTMLDivElement>) {
    if (!onDropRelative) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const side = insertSide;
    setInsertSide(null);
    const dropped = takeDraggingPlayer();
    if (!dropped || dropped.id === player.playerId || !side) {
      return;
    }
    onDropRelative(dropped, side);
  }

  return (
    <div
      className="relative"
      onDragOver={onWrapperDragOver}
      onDragLeave={onWrapperDragLeave}
      onDrop={onWrapperDrop}
    >
      {insertSide === "before" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-1.5 top-1 bottom-1 z-30 w-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
        />
      ) : null}
      {insertSide === "after" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-1.5 top-1 bottom-1 z-30 w-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
        />
      ) : null}
      {onRemove && !selecting ? (
        <button
          type="button"
          aria-label={`Remove ${player.fullName} from board`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-background text-xs leading-none text-zinc-500 hover:border-zinc-500 hover:text-foreground dark:border-zinc-600"
        >
          ×
        </button>
      ) : null}
      <button
        type="button"
        draggable={!selecting}
        aria-pressed={selecting ? selected : undefined}
        onClick={() => {
          if (didDrag.current) {
            didDrag.current = false;
            return;
          }
          if (selecting) {
            onToggleSelect?.();
            return;
          }
          onSelect();
        }}
        onDragStart={selecting ? undefined : onDragStart}
        className={`flex w-24 flex-col items-center rounded-lg border bg-background px-2 py-2 text-center hover:border-zinc-400 dark:hover:border-zinc-500 ${
          selected
            ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
            : "border-zinc-200 dark:border-zinc-700"
        }`}
      >
        <PlayerPhoto
          nbaPersonId={player.nbaPersonId}
          fullName={player.fullName}
          size="compact"
          photoSize={80}
        />
        <span className="mt-2 min-w-0 w-full">
          <span className="block truncate text-xs font-semibold">{player.fullName}</span>
          <span className="block truncate text-[10px] text-zinc-500">
            {player.teamAbbr ?? "FA"} · {player.position ?? "—"}
          </span>
        </span>
      </button>
    </div>
  );
}
