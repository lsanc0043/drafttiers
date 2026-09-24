"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
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
  onSaveNotes?: (notes: string | null) => Promise<void> | void;
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
  selected = false,
  selecting = false,
  onSelect,
  onToggleSelect,
  onRemove,
  onDropRelative,
  onSaveNotes,
  picked = false,
  userDrafted = false,
}: BoardPlayerChipProps) {
  const didDrag = useRef(false);
  const [insertSide, setInsertSide] = useState<InsertSide | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const note = player.notes?.trim() || null;

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
        aria-label={
          userDrafted
            ? `${player.fullName} (your pick)`
            : picked
              ? `${player.fullName} (picked)`
              : player.fullName
        }
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
        onContextMenu={(event) => {
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
        onDragStart={selecting ? undefined : onDragStart}
        className={`flex w-24 flex-col items-center rounded-lg border px-2 py-2 text-center hover:border-zinc-400 dark:hover:border-zinc-500 ${
          userDrafted
            ? "border-emerald-600 bg-emerald-200 dark:border-emerald-500 dark:bg-emerald-900/80"
            : picked
            ? "border-zinc-200 bg-zinc-100 opacity-50 grayscale dark:border-zinc-800 dark:bg-zinc-900"
            : selected
              ? "border-zinc-900 bg-background ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
              : "border-zinc-200 bg-background dark:border-zinc-700"
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
