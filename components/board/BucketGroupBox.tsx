"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { peekDraggingPlayer, takeDraggingPlayer, type PlayerCardData } from "@/components/players/PlayerCard";
import { usePlayerDropHover } from "@/hooks/useBoardDropHover";
import type { BoardBucketGroup } from "@/types";

type BucketGroupBoxProps = {
  group: BoardBucketGroup;
  bucketId: string;
  onDropPlayer: (player: PlayerCardData) => void;
  placingPlayer?: PlayerCardData | null;
  onPlaced?: () => void;
  onDelete: () => void;
  onEdit: () => void;
  children: ReactNode;
};

export function BucketGroupBox({
  group,
  bucketId,
  onDropPlayer,
  placingPlayer = null,
  onPlaced,
  onDelete,
  onEdit,
  children,
}: BucketGroupBoxProps) {
  const [isOver, setIsOver] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const hoverDest = usePlayerDropHover();
  const pointerOver = hoverDest?.groupId === group.id;

  useEffect(() => {
    if (!menu) {
      return;
    }
    function close() {
      setMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    const timer = window.setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!peekDraggingPlayer()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsOver(false);
    const player = takeDraggingPlayer();
    if (player) {
      onDropPlayer(player);
    }
  }

  return (
    <div
      className={`relative min-w-28 rounded-lg border-2 p-2 ${
        isOver || placingPlayer || pointerOver ? "bg-zinc-100 dark:bg-zinc-800" : "bg-background/80"
      }`}
      style={{ borderColor: group.color }}
      data-drop-group={group.id}
      data-drop-bucket={bucketId}
      onDragOver={onDragOver}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      onClick={(event) => {
        if (!placingPlayer) {
          return;
        }
        if (event.target instanceof Element && event.target.closest("button")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onDropPlayer(placingPlayer);
        onPlaced?.();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold" style={{ color: group.color }}>
          {group.name}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:text-foreground"
        >
          Edit
        </button>
      </div>
      <div className="flex min-h-16 flex-wrap content-start gap-2">
        {children}
        {group.playerIds.length === 0 ? (
          <p className="pointer-events-none text-[10px] text-zinc-400">
            {placingPlayer ? "Tap to place" : "Drop players here"}
          </p>
        ) : null}
      </div>
      {menu ? (
        <div
          role="menu"
          className="fixed z-[90] min-w-40 rounded-md border border-zinc-200 bg-background py-1 shadow-xl dark:border-zinc-700"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setMenu(null);
              onEdit();
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setMenu(null);
              onDelete();
            }}
          >
            Delete subcategory
          </button>
        </div>
      ) : null}
    </div>
  );
}
