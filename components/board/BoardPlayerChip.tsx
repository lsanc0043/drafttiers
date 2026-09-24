"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { PlayerDragGrip } from "@/components/board/PlayerDragGrip";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import {
  peekDraggingPlayer,
  setDraggingPlayer,
  takeDraggingPlayer,
  type PlayerCardData,
} from "@/components/players/PlayerCard";
import { hapticTap, isTouchPointer, useCoarsePointer } from "@/hooks/useCoarsePointer";
import { usePlayerDropHover } from "@/hooks/useBoardDropHover";
import { type PlayerDropDest } from "@/lib/board-drop-target";
import type { BoardBucketPlayer } from "@/types";

type InsertSide = "before" | "after";

type BoardPlayerChipProps = {
  player: BoardBucketPlayer;
  bucketId: string;
  groupId?: string | null;
  selected?: boolean;
  selecting?: boolean;
  placingPlayer?: PlayerCardData | null;
  onSelect: () => void;
  onToggleSelect?: () => void;
  onRemove?: () => void;
  onDropRelative?: (player: PlayerCardData, side: InsertSide) => void;
  onPointerDrop?: (player: PlayerCardData, dest: PlayerDropDest) => void;
  onPlaced?: () => void;
  onSaveNotes?: (notes: string | null) => Promise<void> | void;
  onToggleFavorite?: () => void;
  picked?: boolean;
  userDrafted?: boolean;
};

function PlayerNoteModal({
  fullName,
  initialNotes,
  onSave,
  onClose,
}: {
  fullName: string;
  initialNotes: string;
  onSave: (notes: string | null) => Promise<void> | void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialNotes);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, working]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const next = draft.trim();
      await onSave(next.length > 0 ? next : null);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save note");
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close note"
        disabled={working}
        onClick={() => {
          if (!working) {
            onClose();
          }
        }}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-note-title"
        onSubmit={(event) => void submit(event)}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-background p-6 shadow-2xl dark:border-zinc-800"
      >
        <h2 id="player-note-title" className="text-lg font-semibold">
          {initialNotes ? "Edit note" : "Add note"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{fullName}</p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          rows={5}
          autoFocus
          className="mt-4 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-700"
          placeholder="Write a note for this player"
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={working}
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={working}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function BoardPlayerChip({
  player,
  bucketId,
  groupId = null,
  selected = false,
  selecting = false,
  placingPlayer = null,
  onSelect,
  onToggleSelect,
  onRemove,
  onDropRelative,
  onPointerDrop,
  onPlaced,
  onSaveNotes,
  onToggleFavorite,
  picked = false,
  userDrafted = false,
}: BoardPlayerChipProps) {
  const coarse = useCoarsePointer();
  const didDrag = useRef(false);
  const pressRef = useRef<{
    timer: number;
    x: number;
    y: number;
    armed: boolean;
  } | null>(null);
  const [armed, setArmed] = useState(false);
  const [insertSide, setInsertSide] = useState<InsertSide | null>(null);
  const hoverDest = usePlayerDropHover();
  const hoverInsert =
    hoverDest?.relativePlayerId === player.playerId ? hoverDest.side ?? null : null;
  const shownInsert = insertSide ?? hoverInsert;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const note = player.notes?.trim() || null;

  function toCard(): PlayerCardData {
    return {
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
  }

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
      window.addEventListener("scroll", close, true);
    }, 0);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  function onDragStart(event: DragEvent<HTMLButtonElement>) {
    didDrag.current = true;
    setMenu(null);
    setHover(null);
    setDraggingPlayer(toCard());
    event.dataTransfer.setData("text/plain", JSON.stringify(toCard()));
    event.dataTransfer.effectAllowed = "move";
  }

  useEffect(() => {
    return () => {
      if (pressRef.current) {
        window.clearTimeout(pressRef.current.timer);
      }
    };
  }, []);

  function clearPress() {
    if (pressRef.current) {
      window.clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
    setArmed(false);
  }

  function onChipPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (selecting || placingPlayer || !isTouchPointer(event) || event.button !== 0) {
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    clearPress();
    pressRef.current = {
      timer: window.setTimeout(() => {
        if (!pressRef.current) {
          return;
        }
        pressRef.current.armed = true;
        setArmed(true);
        hapticTap();
      }, 400),
      x,
      y,
      armed: false,
    };
  }

  function onChipPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const press = pressRef.current;
    if (!press || !isTouchPointer(event)) {
      return;
    }
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) {
      clearPress();
    }
  }

  function onChipPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    const press = pressRef.current;
    const wasArmed = Boolean(press?.armed);
    const x = event.clientX;
    const y = event.clientY;
    if (press) {
      window.clearTimeout(press.timer);
      pressRef.current = null;
    }
    setArmed(false);
    if (wasArmed && onSaveNotes) {
      didDrag.current = true;
      setMenu({ x, y });
    }
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
      data-drop-chip={player.playerId}
      data-drop-bucket={bucketId}
      data-drop-group={groupId ?? undefined}
      onDragOver={onWrapperDragOver}
      onDragLeave={onWrapperDragLeave}
      onDrop={onWrapperDrop}
      onClick={(event) => {
        if (!placingPlayer || placingPlayer.id === player.playerId || !onPointerDrop) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const box = event.currentTarget.getBoundingClientRect();
        onPointerDrop(placingPlayer, {
          bucketId,
          groupId,
          relativePlayerId: player.playerId,
          side: event.clientX < box.left + box.width / 2 ? "before" : "after",
        });
        onPlaced?.();
      }}
    >
      {shownInsert === "before" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-1.5 top-1 bottom-1 z-30 w-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
        />
      ) : null}
      {shownInsert === "after" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-1.5 top-1 bottom-1 z-30 w-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
        />
      ) : null}
      {onToggleFavorite && !selecting ? (
        <button
          type="button"
          aria-label={
            player.favorited
              ? `Unfavorite ${player.fullName}`
              : `Favorite ${player.fullName}`
          }
          aria-pressed={player.favorited}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute -left-0.5 -top-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full border bg-background text-xs leading-none sm:-left-1 sm:-top-1 sm:h-5 sm:w-5 ${
            player.favorited
              ? "border-amber-400 text-amber-500"
              : "border-zinc-300 text-zinc-400 hover:border-zinc-500 hover:text-foreground dark:border-zinc-600"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
            <path
              d="M12 3.6l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.58 7.3 18.05l.9-5.23-3.8-3.7 5.25-.76L12 3.6z"
              fill={player.favorited ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      {onRemove && !selecting ? (
        <button
          type="button"
          aria-label={`Remove ${player.fullName} from board`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="absolute -right-0.5 -top-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 bg-background text-xs leading-none text-zinc-500 hover:border-zinc-500 hover:text-foreground sm:-right-1 sm:-top-1 sm:h-5 sm:w-5 dark:border-zinc-600"
        >
          ×
        </button>
      ) : null}
      {coarse && !selecting && onPointerDrop ? (
        <div className="absolute -right-0.5 -bottom-0.5 z-20 sm:-right-1 sm:-bottom-1">
          <PlayerDragGrip player={toCard()} onDrop={onPointerDrop} compact />
        </div>
      ) : null}
      <button
        type="button"
        draggable={!selecting && !coarse}
        aria-pressed={selecting ? selected : undefined}
        aria-label={
          userDrafted
            ? `${player.fullName} (your pick)`
            : picked
              ? `${player.fullName} (picked)`
              : player.fullName
        }
        onClick={(event) => {
          if (placingPlayer) {
            event.preventDefault();
            return;
          }
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
        onPointerDown={onChipPointerDown}
        onPointerMove={onChipPointerMove}
        onPointerUp={onChipPointerEnd}
        onPointerCancel={onChipPointerEnd}
        onContextMenu={(event) => {
          if (coarse) {
            event.preventDefault();
            return;
          }
          if (!onSaveNotes) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setHover(null);
          setMenu({ x: event.clientX, y: event.clientY });
        }}
        onMouseEnter={(event) => {
          if (!note || menu || noteOpen) {
            return;
          }
          const box = event.currentTarget.getBoundingClientRect();
          setHover({ x: box.left, y: box.bottom + 8 });
        }}
        onMouseLeave={() => setHover(null)}
        onDragStart={selecting || coarse ? undefined : onDragStart}
        className={`flex w-[3.75rem] flex-col items-center rounded-lg border px-1 py-1 text-center hover:border-zinc-400 sm:w-24 sm:px-2 sm:py-2 dark:hover:border-zinc-500 ${
          armed ? "scale-105 ring-2 ring-zinc-900 dark:ring-zinc-100" : ""
        } ${
          userDrafted
            ? "border-emerald-600 bg-emerald-200 dark:border-emerald-500 dark:bg-emerald-900/80"
            : picked
            ? "border-zinc-200 bg-zinc-100 opacity-50 grayscale dark:border-zinc-800 dark:bg-zinc-900"
            : selected
              ? "border-zinc-900 bg-background ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
              : player.favorited
                ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40"
                : "border-zinc-200 bg-background dark:border-zinc-700"
        }`}
      >
        <PlayerPhoto
          nbaPersonId={player.nbaPersonId}
          fullName={player.fullName}
          size="compact"
        />
        <span className="mt-1 min-w-0 w-full sm:mt-2">
          <span className="block truncate text-[10px] font-semibold sm:text-xs">{player.fullName}</span>
          <span className="block truncate text-[9px] text-zinc-500 sm:text-[10px]">
            {userDrafted
              ? "Yours"
              : picked
                ? "Picked"
                : `${player.teamAbbr ?? "FA"} · ${player.position ?? "—"}`}
          </span>
        </span>
        {note ? (
          <span className="mt-1 rounded bg-amber-500/20 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Note
          </span>
        ) : null}
      </button>
      {menu && onSaveNotes
        ? createPortal(
            <div
              role="menu"
              className="fixed z-[90] min-w-36 rounded-md border border-zinc-200 bg-background py-1 shadow-xl dark:border-zinc-700"
              style={{ left: menu.x, top: menu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  setMenu(null);
                  setNoteOpen(true);
                }}
              >
                {note ? "Edit note" : "Add note"}
              </button>
              {note ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => {
                    setMenu(null);
                    void onSaveNotes(null);
                  }}
                >
                  Delete note
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
      {hover && note
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[80] max-w-64 rounded-md border border-zinc-200 bg-background px-2 py-1.5 text-xs shadow-xl dark:border-zinc-700"
              style={{ left: hover.x, top: hover.y }}
            >
              <p className="whitespace-pre-wrap break-words">{note}</p>
            </div>,
            document.body,
          )
        : null}
      {noteOpen && onSaveNotes ? (
        <PlayerNoteModal
          fullName={player.fullName}
          initialNotes={note ?? ""}
          onSave={onSaveNotes}
          onClose={() => setNoteOpen(false)}
        />
      ) : null}
    </div>
  );
}
