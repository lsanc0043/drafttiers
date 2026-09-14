"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DraftSettingsModal } from "@/components/board/DraftSettingsModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useFantasyScoring } from "@/hooks/useFantasyScoring";
import type { DraftSettingsInput } from "@/lib/validation";
import type { BoardSummary } from "@/types";

export function BoardList() {
  const router = useRouter();
  const { scoring } = useFantasyScoring();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [boardToDelete, setBoardToDelete] = useState<BoardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/boards", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load boards");
        }
        const payload = (await response.json()) as { boards: BoardSummary[] };
        setBoards(payload.boards);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load boards");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  async function createBoard(draftSettings: DraftSettingsInput | null) {
    if (creating) {
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled board", draftSettings }),
      });
      const payload = (await response.json()) as { board?: { id: string }; error?: unknown };
      if (!response.ok || !payload.board) {
        throw new Error("Could not create board");
      }
      router.push(`/boards/${payload.board.id}`);
    } catch (createError) {
      setCreating(false);
      throw createError instanceof Error ? createError : new Error("Could not create board");
    }
  }

  async function onDeleteBoard(board: BoardSummary) {
    setDeletingId(board.id);
    setError(null);
    try {
      const response = await fetch(`/api/boards/${board.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Could not delete board");
      }
      setBoards((current) => current.filter((item) => item.id !== board.id));
      setBoardToDelete(null);
    } catch (deleteError) {
      throw deleteError instanceof Error ? deleteError : new Error("Could not delete board");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-zinc-500">Create a board, then set up tiers and colors.</p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={creating}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create board
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading boards...</p>
      ) : boards.length === 0 ? (
        <p className="text-sm text-zinc-500">No boards yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.map((board) => (
            <li key={board.id} className="relative">
              <Link
                href={`/boards/${board.id}`}
                className="block rounded-xl border border-zinc-200 p-4 pr-12 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <h2 className="font-medium">{board.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {board.bucketCount} {board.bucketCount === 1 ? "tier" : "tiers"}
                  {board.hasDraftSettings ? " · Draft settings saved" : ""}
                </p>
              </Link>
              <button
                type="button"
                aria-label={`Delete ${board.name}`}
                disabled={deletingId === board.id}
                onClick={() => setBoardToDelete(board)}
                className="absolute top-3 right-3 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {createOpen ? (
        <DraftSettingsModal
          title="New board"
          submitLabel="Create board"
          allowSkip
          skipLabel="Skip for now"
          defaultScoring={scoring}
          onClose={() => {
            if (!creating) {
              setCreateOpen(false);
            }
          }}
          onSkip={() => createBoard(null)}
          onSave={(settings) => createBoard(settings)}
        />
      ) : null}
      {boardToDelete ? (
        <ConfirmModal
          title="Delete board"
          description={`Delete "${boardToDelete.name}"? This removes the board, its tiers, and assigned players.`}
          confirmLabel="Delete board"
          onClose={() => {
            if (!deletingId) {
              setBoardToDelete(null);
            }
          }}
          onConfirm={() => onDeleteBoard(boardToDelete)}
        />
      ) : null}
    </div>
  );
}
