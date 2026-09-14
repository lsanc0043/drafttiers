"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { Children } from "react";
import { takeDraggingPlayer, type PlayerCardData } from "@/components/players/PlayerCard";

function parseDroppedPlayer(payload: string) {
  try {
    const parsed = JSON.parse(payload) as PlayerCardData;
    if (parsed?.id && parsed.fullName) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
function contrastText(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) {
    return "#111111";
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#111111" : "#F8F8FF";
}

type BucketColumnProps = {
  id: string;
  name: string;
  color: string;
  onEdit: () => void;
  onDelete: () => void;
  onDropPlayer?: (player: PlayerCardData, beforePlayerId?: string) => void;
  children?: ReactNode;
};

export function BucketColumn({
  id,
  name,
  color,
  onEdit,
  onDelete,
  onDropPlayer,
  children,
}: BucketColumnProps) {
  const labelColor = contrastText(color);
  const [isOver, setIsOver] = useState(false);

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!onDropPlayer) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (!onDropPlayer) {
      return;
    }
    event.preventDefault();
    setIsOver(false);
    const player =
      takeDraggingPlayer() ?? parseDroppedPlayer(event.dataTransfer.getData("text/plain"));
    if (player) {
      onDropPlayer(player);
    }
  }

  return (
    <div className="flex min-h-20 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div
        className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 px-2 py-3 sm:w-36"
        style={{ backgroundColor: color, color: labelColor }}
      >
        <p className="text-center text-lg font-bold tracking-wide">{name}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-black/10"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-black/10"
            aria-label={`Delete ${name || "tier"}`}
          >
            Delete
          </button>
        </div>
      </div>
      <div
        data-bucket-drop={id}
        onDragOver={onDragOver}
        onDragEnter={() => setIsOver(true)}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        className={`flex min-h-20 min-w-0 flex-1 flex-wrap content-start gap-2 px-3 py-2 ${
          isOver ? "bg-zinc-200/80 dark:bg-zinc-800/80" : "bg-zinc-50/80 dark:bg-zinc-900/40"
        }`}
      >
        {Children.count(children) === 0 ? (
          <p className="pointer-events-none text-xs text-zinc-400">Drop players here</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
