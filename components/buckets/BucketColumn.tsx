"use client";

import { useEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { Children } from "react";
import { createPortal } from "react-dom";
import {
  peekDraggingPlayer,
  takeDraggingPlayer,
  type PlayerCardData,
} from "@/components/players/PlayerCard";
import { isGripDragPointer, useCoarsePointer } from "@/hooks/useCoarsePointer";
import { usePlayerDropHover, useTierDropHover } from "@/hooks/useBoardDropHover";
import { clearDropHover, setTierDropHover } from "@/lib/board-drop-hover";
import { resolveTierDropDest } from "@/lib/board-drop-target";

export const TIER_DRAG_TYPE = "application/x-drafttiers-tier";

let draggingBucketId: string | null = null;

export function peekDraggingBucketId() {
  return draggingBucketId;
}

export function takeDraggingBucketId() {
  const id = draggingBucketId;
  draggingBucketId = null;
  return id;
}

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
  onCreateSubcategory?: () => void;
  onReorder?: (draggedId: string, targetId: string, side: "before" | "after") => void;
  onDropPlayer?: (player: PlayerCardData, beforePlayerId?: string) => void;
  placingPlayer?: PlayerCardData | null;
  onPlaced?: () => void;
  children?: ReactNode;
};

export function BucketColumn({
  id,
  name,
  color,
  onEdit,
  onDelete,
  onCreateSubcategory,
  onReorder,
  onDropPlayer,
  placingPlayer = null,
  onPlaced,
  children,
}: BucketColumnProps) {
  const coarse = useCoarsePointer();
  const labelColor = contrastText(color);
  const [isOver, setIsOver] = useState(false);
  const [insertSide, setInsertSide] = useState<"before" | "after" | null>(null);
  const hoverPlayer = usePlayerDropHover();
  const hoverTier = useTierDropHover();
  const pointerOverBucket = hoverPlayer?.bucketId === id && hoverPlayer.groupId == null;
  const shownInsert =
    insertSide ?? (hoverTier?.targetId === id ? hoverTier.side : null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [gripPos, setGripPos] = useState<{ x: number; y: number } | null>(null);
  const longPress = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function clearLongPress() {
    if (longPress.current != null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  }

  function openMenu(x: number, y: number) {
    setMenu({ x, y });
  }

  function onHeaderPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || event.button !== 0) {
      return;
    }
    const { clientX, clientY } = event;
    clearLongPress();
    longPress.current = window.setTimeout(() => {
      openMenu(clientX, clientY);
    }, 500);
  }

  function onGripPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!onReorder || !isGripDragPointer(event) || event.button !== 0) {
      return;
    }
    event.preventDefault();
    clearLongPress();
    draggingBucketId = id;
    setGripPos({ x: event.clientX, y: event.clientY });
    const dest = resolveTierDropDest(event.clientX, event.clientY, id);
    setTierDropHover(dest ? { ...dest, sourceId: id } : null);
    document.body.style.overflow = "hidden";
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort on older WebViews.
    }
  }

  function onGripPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!gripPos) {
      return;
    }
    event.preventDefault();
    setGripPos({ x: event.clientX, y: event.clientY });
    const dest = resolveTierDropDest(event.clientX, event.clientY, id);
    setTierDropHover(dest ? { ...dest, sourceId: id } : null);
  }

  function onGripPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (!gripPos) {
      return;
    }
    const dest = resolveTierDropDest(event.clientX, event.clientY, id);
    setGripPos(null);
    draggingBucketId = null;
    document.body.style.overflow = "";
    clearDropHover();
    if (dest && onReorder) {
      onReorder(id, dest.targetId, dest.side);
    }
  }

  function placeIfHolding() {
    if (!placingPlayer || !onDropPlayer) {
      return false;
    }
    onDropPlayer(placingPlayer);
    onPlaced?.();
    return true;
  }

  function onPlayerDragOver(event: DragEvent<HTMLDivElement>) {
    if (peekDraggingBucketId()) {
      return;
    }
    if (!onDropPlayer || !peekDraggingPlayer()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  }

  function onPlayerDrop(event: DragEvent<HTMLDivElement>) {
    if (peekDraggingBucketId()) {
      return;
    }
    if (!onDropPlayer) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setIsOver(false);
    const player =
      takeDraggingPlayer() ?? parseDroppedPlayer(event.dataTransfer.getData("text/plain"));
    if (player) {
      onDropPlayer(player);
    }
  }

  function onTierDragOver(event: DragEvent<HTMLDivElement>) {
    const draggingTier = peekDraggingBucketId();
    if (!draggingTier || !onReorder || draggingTier === id) {
      setInsertSide(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const box = event.currentTarget.getBoundingClientRect();
    setInsertSide(event.clientY < box.top + box.height / 2 ? "before" : "after");
  }

  function onTierDrop(event: DragEvent<HTMLDivElement>) {
    const draggedTier = takeDraggingBucketId();
    if (!draggedTier || !onReorder) {
      return;
    }
    event.preventDefault();
    const side = insertSide;
    setInsertSide(null);
    if (side && draggedTier !== id) {
      onReorder(draggedTier, id, side);
    }
  }

  return (
    <div
      className={`relative flex min-h-20 flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 ${
        coarse ? "" : "md:flex-row"
      } ${placingPlayer ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : ""}`}
      data-tier-id={id}
      data-drop-bucket={id}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        if (!placingPlayer) {
          return;
        }
        if (event.target instanceof Element && event.target.closest("button")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        placeIfHolding();
      }}
      onDragOver={onTierDragOver}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
          return;
        }
        setInsertSide(null);
      }}
      onDrop={onTierDrop}
    >
      {shownInsert === "before" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 -top-1 z-30 h-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
        />
      ) : null}
      {shownInsert === "after" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 -bottom-1 z-30 h-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
        />
      ) : null}
      <div
        className={`flex w-full shrink-0 items-center justify-between gap-2 px-3 py-2 ${
          coarse ? "" : "md:w-28 md:flex-col md:items-center md:justify-center md:px-2 md:py-3 lg:w-36"
        }`}
        style={{ backgroundColor: color, color: labelColor }}
        onPointerDown={onHeaderPointerDown}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerMove={clearLongPress}
      >
        <div className={`flex min-w-0 flex-1 items-center gap-2 ${coarse ? "" : "md:flex-col"}`}>
          {onReorder ? (
            <button
              type="button"
              draggable={!coarse}
              aria-label={`Reorder ${name || "tier"}`}
              className="shrink-0 cursor-grab touch-none rounded p-1 hover:bg-black/10 active:cursor-grabbing"
              onPointerDown={onGripPointerDown}
              onPointerMove={onGripPointerMove}
              onPointerUp={onGripPointerEnd}
              onPointerCancel={onGripPointerEnd}
              onDragStart={(event) => {
                clearLongPress();
                setMenu(null);
                draggingBucketId = id;
                event.dataTransfer.setData(TIER_DRAG_TYPE, id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                draggingBucketId = null;
                setInsertSide(null);
              }}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <circle cx="5" cy="3" r="1.2" fill="currentColor" />
                <circle cx="11" cy="3" r="1.2" fill="currentColor" />
                <circle cx="5" cy="8" r="1.2" fill="currentColor" />
                <circle cx="11" cy="8" r="1.2" fill="currentColor" />
                <circle cx="5" cy="13" r="1.2" fill="currentColor" />
                <circle cx="11" cy="13" r="1.2" fill="currentColor" />
              </svg>
            </button>
          ) : null}
          <p
            className={`min-w-0 truncate text-sm font-bold tracking-wide ${
              coarse ? "" : "md:text-center md:text-lg"
            }`}
          >
            {name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            draggable={false}
            onClick={onEdit}
            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-black/10"
          >
            Edit
          </button>
          <button
            type="button"
            draggable={false}
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
        data-drop-bucket={id}
        onDragOver={onPlayerDragOver}
        onDragEnter={() => {
          if (peekDraggingPlayer()) {
            setIsOver(true);
          }
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onPlayerDrop}
        className={`flex min-h-16 min-w-0 flex-1 flex-wrap content-start gap-1.5 px-2 py-2 md:min-h-20 md:gap-2 md:px-3 ${
          isOver || placingPlayer || pointerOverBucket
            ? "bg-zinc-200/80 dark:bg-zinc-800/80"
            : "bg-zinc-50/80 dark:bg-zinc-900/40"
        }`}
      >
        {Children.count(children) === 0 ? (
          <p className="pointer-events-none text-xs text-zinc-400">
            {placingPlayer ? "Tap to place" : "Drop players here"}
          </p>
        ) : (
          children
        )}
      </div>
      {gripPos
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2 rounded-md px-3 py-1 text-sm font-bold shadow-2xl"
              data-drop-ignore="true"
              style={{
                left: gripPos.x,
                top: gripPos.y,
                backgroundColor: color,
                color: labelColor,
              }}
            >
              {name}
            </div>,
            document.body,
          )
        : null}
      {menu ? (
        <div
          role="menu"
          className="fixed z-[90] min-w-40 rounded-md border border-zinc-200 bg-background py-1 shadow-xl dark:border-zinc-700"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {onCreateSubcategory ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                setMenu(null);
                onCreateSubcategory();
              }}
            >
              Create subcategory
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setMenu(null);
              onEdit();
            }}
          >
            Edit tier
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
            Delete tier
          </button>
        </div>
      ) : null}
    </div>
  );
}
