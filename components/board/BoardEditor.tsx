"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BucketGroupBox } from "@/components/board/BucketGroupBox";
import { BoardPlayerChip } from "@/components/board/BoardPlayerChip";
import { DraftBoardCanvas } from "@/components/board/DraftBoardCanvas";
import { DraftSettingsModal } from "@/components/board/DraftSettingsModal";
import { FavoritesRosterPanel } from "@/components/board/FavoritesRosterPanel";
import { SleeperLiveTrackingBar } from "@/components/board/SleeperLiveTrackingBar";
import { TierModal } from "@/components/board/TierModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BucketColumn } from "@/components/buckets/BucketColumn";
import { type PlayerCardData } from "@/components/players/PlayerCard";
import { PlayerDirectory } from "@/components/players/PlayerDirectory";
import { PlayerModal } from "@/components/players/PlayerModal";
import { PlayerBrowseSheet } from "@/components/board/PlayerBrowseSheet";
import { HeldPlayerTray } from "@/components/board/HeldPlayerTray";
import { LockInExplorer } from "@/components/statdunk/LockInExplorer";
import { useFantasyScoring } from "@/hooks/useFantasyScoring";
import { useSleeperLivePicks } from "@/hooks/useSleeperLivePicks";
import { placeBoardPlayer, removeBoardPlayer, removeBoardPlayers, moveBoardPlayers, clearBoardPlayers, clearBoardFavoritesLocal, setBoardPlayerNotes, setBoardPlayerFavorited } from "@/lib/board-players";
import { moveBucketRelative } from "@/lib/board-buckets";
import { addBoardGroup, deleteBucketGroup, groupedPlayerIdSet, nextGroupColor, uniqueBoardGroups, updateBucketGroup } from "@/lib/board-groups";
import {
  evaluateFavoriteLineup,
  resolveBoardRosterRequirements,
  toDraftedRosterPlayers,
} from "@/lib/sleeper/roster";
import type { LockInBundle } from "@/lib/statdunk/load";
import { nextAlternatingTierColor, type DraftSettingsInput } from "@/lib/validation";
import { type PlayerDropDest } from "@/lib/board-drop-target";
import type { BoardBucket, BoardBucketGroup, BoardBucketPlayer, BoardDetail } from "@/types";

type BoardEditorProps = {
  boardId: string;
  lockIn?: LockInBundle | null;
};

function toBoardPlayer(player: PlayerCardData, existing?: BoardBucketPlayer): BoardBucketPlayer {
  if (existing) {
    return existing;
  }
  return {
    assignmentId: `pending-${player.id}`,
    playerId: player.id,
    nbaPersonId: player.nbaPersonId,
    fullName: player.fullName,
    teamAbbr: player.teamAbbr,
    teamName: player.teamName,
    position: player.position,
    jerseyNumber: player.jerseyNumber,
    isActive: player.isActive,
    sortOrder: 0,
    notes: null,
    favorited: false,
  };
}

function toPlayerCard(player: BoardBucketPlayer): PlayerCardData {
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

export function BoardEditor({ boardId, lockIn = null }: BoardEditorProps) {
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierModal, setTierModal] = useState<"create" | BoardBucket | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseSnap, setBrowseSnap] = useState<"half" | "full">("half");
  const [browseCatalog, setBrowseCatalog] = useState<"lock-in" | "last-season">("lock-in");
  const [showOnBoardPlayers, setShowOnBoardPlayers] = useState(false);
  const [heldPlayer, setHeldPlayer] = useState<PlayerCardData | null>(null);
  const [browseWidthPct, setBrowseWidthPct] = useState(50);
  const splitRef = useRef<HTMLDivElement>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerCardData | null>(null);
  const [groupModal, setGroupModal] = useState<
    | { mode: "create"; playerIds: string[] }
    | { mode: "edit"; group: BoardBucketGroup }
    | null
  >(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { scoring } = useFantasyScoring();
  const boardPlayers = board?.buckets.flatMap((bucket) => bucket.players) ?? [];
  const tracking = useSleeperLivePicks({
    boardId,
    players: boardPlayers,
    initialDraftId: board?.sleeperDraftId ?? board?.draftSettings?.sleeperDraftId ?? null,
    initialDraftPosition: board?.draftSettings?.draftPosition ?? null,
    initialTeamCount: board?.draftSettings?.teamCount ?? null,
    initialDraftType: board?.draftSettings?.draftType ?? null,
    onPersistDraftId: (draftId) => {
      void fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleeperDraftId: draftId }),
      }).then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { board?: BoardDetail };
        if (payload.board) {
          setBoard(payload.board);
        }
      });
    },
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/boards/${boardId}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          throw new Error("Board not found");
        }
        if (!response.ok) {
          throw new Error("Could not load board");
        }
        const payload = (await response.json()) as { board: BoardDetail };
        setBoard(payload.board);
        setTitle(payload.board.name);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load board");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [boardId]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (!heldPlayer) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHeldPlayer(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [heldPlayer]);

  function clampBrowseWidth(percent: number) {
    return Math.min(90, Math.max(50, percent));
  }

  function setBrowseWidthFromClientX(clientX: number) {
    const split = splitRef.current;
    if (!split) {
      return;
    }
    const box = split.getBoundingClientRect();
    if (box.width <= 0) {
      return;
    }
    setBrowseWidthPct(clampBrowseWidth(((box.right - clientX) / box.width) * 100));
  }

  function onBrowseResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setBrowseWidthFromClientX(event.clientX);
  }

  async function saveTitle(nextName: string) {
    const name = nextName.trim();
    setEditingTitle(false);
    if (!board || !name || name === board.name) {
      setTitle(board?.name ?? "");
      return;
    }
    const response = await fetch(`/api/boards/${board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError("Could not rename board");
      setTitle(board.name);
      return;
    }
    const payload = (await response.json()) as { board: BoardDetail };
    setBoard(payload.board);
    setTitle(payload.board.name);
    setError(null);
  }

  async function onSaveDraftSettings(settings: DraftSettingsInput) {
    if (!board) {
      return;
    }
    const response = await fetch(`/api/boards/${board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftSettings: settings }),
    });
    if (!response.ok) {
      throw new Error("Could not save draft settings");
    }
    const payload = (await response.json()) as { board: BoardDetail };
    setBoard(payload.board);
    setSettingsOpen(false);
    setError(null);
  }

  async function onCreateTier(input: { name: string; color: string }) {
    if (!board) {
      return;
    }
    const response = await fetch(`/api/boards/${board.id}/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error("Could not create tier");
    }
    const payload = (await response.json()) as { bucket: BoardBucket };
    setBoard({ ...board, buckets: [...board.buckets, { ...payload.bucket, players: [], groups: payload.bucket.groups ?? uniqueBoardGroups(board.buckets).map((group) => ({ ...group, playerIds: [] })) }] });
    setTierModal(null);
    setError(null);
  }

  async function onUpdateTier(bucket: BoardBucket, input: { name: string; color: string }) {
    if (!board) {
      return;
    }
    const response = await fetch(`/api/boards/${board.id}/buckets/${bucket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error("Could not update tier");
    }
    const payload = (await response.json()) as { bucket: BoardBucket };
    setBoard({
      ...board,
      buckets: board.buckets.map((item) =>
        item.id === payload.bucket.id ? { ...payload.bucket, players: item.players } : item,
      ),
    });
    setTierModal(null);
    setError(null);
  }

  async function onDeleteTier(bucketId: string) {
    if (!board) {
      return;
    }
    const response = await fetch(`/api/boards/${board.id}/buckets/${bucketId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not delete tier");
      return;
    }
    setBoard({
      ...board,
      buckets: board.buckets.filter((item) => item.id !== bucketId),
    });
    setSelectedIds((current) => {
      const removed = new Set(
        board.buckets.find((item) => item.id === bucketId)?.players.map((player) => player.playerId) ??
          [],
      );
      return current.filter((id) => !removed.has(id));
    });
    setError(null);
  }

  async function onReorderTiers(
    draggedId: string,
    targetId: string,
    side: "before" | "after",
  ) {
    if (!board) {
      return;
    }
    const nextBuckets = moveBucketRelative(board.buckets, draggedId, targetId, side);
    if (nextBuckets.every((bucket, index) => bucket.id === board.buckets[index]?.id)) {
      return;
    }
    const previous = board;
    setBoard({ ...board, buckets: nextBuckets });
    const response = await fetch(`/api/boards/${board.id}/buckets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: nextBuckets.map((bucket) => bucket.id) }),
    });
    if (!response.ok) {
      setBoard(previous);
      setError("Could not reorder tiers");
      return;
    }
    setError(null);
  }

  async function onDropPlayer(
    bucketId: string,
    player: PlayerCardData,
    beforePlayerId?: string,
    groupId?: string | null,
  ) {
    if (!board || player.id === beforePlayerId) {
      return;
    }

    const existing = board.buckets
      .flatMap((bucket) => bucket.players)
      .find((entry) => entry.playerId === player.id);
    const previous = board;
    const optimistic = toBoardPlayer(player, existing);
    setBoard({
      ...board,
      buckets: placeBoardPlayer(board.buckets, optimistic, bucketId, beforePlayerId, groupId),
    });

    const response = await fetch(`/api/boards/${board.id}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: player.id,
        bucketId,
        groupId: groupId ?? null,
        ...(beforePlayerId ? { beforePlayerId } : {}),
      }),
    });
    if (!response.ok) {
      setBoard(previous);
      setError("Could not add player to tier");
      return;
    }
    const payload = (await response.json()) as {
      player: BoardBucketPlayer;
      bucketId: string;
    };
    setBoard((current) =>
      current
        ? {
            ...current,
            buckets: placeBoardPlayer(
              current.buckets,
              payload.player,
              payload.bucketId,
              beforePlayerId,
              groupId,
            ),
          }
        : current,
    );
    setError(null);
  }

  function applyPlayerDrop(player: PlayerCardData, dest: PlayerDropDest) {
    if (!board) {
      return;
    }
    if (dest.relativePlayerId && dest.side === "before") {
      void onDropPlayer(dest.bucketId, player, dest.relativePlayerId, dest.groupId);
    } else if (dest.relativePlayerId && dest.side === "after") {
      const bucket = board.buckets.find((entry) => entry.id === dest.bucketId);
      const afterIndex =
        bucket?.players.findIndex((entry) => entry.playerId === dest.relativePlayerId) ?? -1;
      const next = bucket?.players
        .slice(afterIndex + 1)
        .find((entry) => entry.playerId !== player.id);
      void onDropPlayer(dest.bucketId, player, next?.playerId, dest.groupId);
    } else {
      void onDropPlayer(dest.bucketId, player, undefined, dest.groupId);
    }
    setHeldPlayer(null);
  }

  async function onRemovePlayer(playerId: string) {
    if (!board) {
      return;
    }
    const previous = board;
    setBoard({ ...board, buckets: removeBoardPlayer(board.buckets, playerId) });
    setSelectedPlayer((current) => (current?.id === playerId ? null : current));
    setSelectedIds((current) => current.filter((id) => id !== playerId));
    const response = await fetch(`/api/boards/${board.id}/players/${playerId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setBoard(previous);
      setError("Could not remove player from board");
      return;
    }
    setError(null);
  }

  async function onSaveNotes(playerId: string, notes: string | null) {
    if (!board) {
      return;
    }
    const previous = board;
    setBoard({ ...board, buckets: setBoardPlayerNotes(board.buckets, playerId, notes) });
    const response = await fetch(`/api/boards/${board.id}/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!response.ok) {
      setBoard(previous);
      setError("Could not save note");
      throw new Error("Could not save note");
    }
    const payload = (await response.json()) as { player?: BoardBucketPlayer };
    if (payload.player) {
      setBoard((current) =>
        current
          ? {
              ...current,
              buckets: setBoardPlayerNotes(current.buckets, playerId, payload.player?.notes ?? null),
            }
          : current,
      );
    }
    setError(null);
  }

  async function onToggleFavorite(playerId: string, favorited: boolean) {
    if (!board) {
      return;
    }
    const previous = board;
    setBoard({ ...board, buckets: setBoardPlayerFavorited(board.buckets, playerId, favorited) });
    const response = await fetch(`/api/boards/${board.id}/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorited }),
    });
    if (!response.ok) {
      setBoard(previous);
      setError("Could not update favorite");
      return;
    }
    const payload = (await response.json()) as { player?: BoardBucketPlayer };
    if (payload.player) {
      setBoard((current) =>
        current
          ? {
              ...current,
              buckets: setBoardPlayerFavorited(
                current.buckets,
                playerId,
                payload.player?.favorited ?? favorited,
              ),
            }
          : current,
      );
    }
    setError(null);
  }

  async function onClearFavorites() {
    if (!board) {
      return;
    }
    const hasFavorite = board.buckets.some((bucket) =>
      bucket.players.some((player) => player.favorited),
    );
    if (!hasFavorite) {
      return;
    }
    const previous = board;
    setBoard({ ...board, buckets: clearBoardFavoritesLocal(board.buckets) });
    const response = await fetch(`/api/boards/${board.id}/favorites`, { method: "DELETE" });
    if (!response.ok) {
      setBoard(previous);
      setError("Could not clear favorites");
      return;
    }
    setError(null);
  }

  async function onCreateGroup(input: { name: string; color: string }) {
    if (!board || groupModal?.mode !== "create") {
      return;
    }
    const previous = board;
    const group: BoardBucketGroup = {
      id: `pending-${crypto.randomUUID()}`,
      name: input.name,
      color: input.color,
      playerIds: groupModal.playerIds,
    };
    setBoard({
      ...board,
      buckets: addBoardGroup(board.buckets, group),
    });
    const response = await fetch(`/api/boards/${board.id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        color: input.color,
        playerIds: groupModal.playerIds,
      }),
    });
    if (!response.ok) {
      setBoard(previous);
      throw new Error("Could not create subcategory");
    }
    const payload = (await response.json()) as { group: BoardBucketGroup };
    setBoard((current) =>
      current
        ? {
            ...current,
            buckets: addBoardGroup(deleteBucketGroup(current.buckets, group.id), payload.group),
          }
        : current,
    );
    setGroupModal(null);
    setSelectedIds([]);
    setSelecting(false);
    setError(null);
  }

  async function onUpdateGroup(input: { name: string; color: string }) {
    if (!board || groupModal?.mode !== "edit") {
      return;
    }
    const previous = board;
    const groupId = groupModal.group.id;
    setBoard({
      ...board,
      buckets: updateBucketGroup(board.buckets, groupId, input),
    });
    const response = await fetch(`/api/boards/${board.id}/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      setBoard(previous);
      throw new Error("Could not update subcategory");
    }
    setGroupModal(null);
    setError(null);
  }

  async function onDeleteGroup(groupId: string) {
    if (!board) {
      return;
    }
    const previous = board;
    setBoard({ ...board, buckets: deleteBucketGroup(board.buckets, groupId) });
    const response = await fetch(`/api/boards/${board.id}/groups/${groupId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setBoard(previous);
      setError("Could not delete subcategory");
      return;
    }
    setError(null);
  }

  async function onResetPlayers() {
    if (!board) {
      return;
    }
    const previous = board;
    setBoard({ ...board, buckets: clearBoardPlayers(board.buckets) });
    setSelectedPlayer(null);
    setSelectedIds([]);
    setSelecting(false);
    const response = await fetch(`/api/boards/${board.id}/players`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setBoard(previous);
      throw new Error("Could not reset board players");
    }
    setResetOpen(false);
    setError(null);
  }

  async function onBulkPlayers(action: "move" | "unassign", bucketId?: string) {
    if (!board || selectedIds.length === 0) {
      return;
    }
    const previous = board;
    const playerIds = selectedIds;
    setBoard({
      ...board,
      buckets:
        action === "unassign"
          ? removeBoardPlayers(board.buckets, playerIds)
          : moveBoardPlayers(board.buckets, playerIds, bucketId ?? ""),
    });
    setSelectedIds([]);
    setSelectedPlayer((current) =>
      current && playerIds.includes(current.id) ? null : current,
    );
    const response = await fetch(`/api/boards/${board.id}/players`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        playerIds,
        ...(bucketId ? { bucketId } : {}),
      }),
    });
    if (!response.ok) {
      setBoard(previous);
      setSelectedIds(playerIds);
      setError(action === "unassign" ? "Could not unassign players" : "Could not move players");
      return;
    }
    setError(null);
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading board...</p>;
  }

  if (!board) {
    return <p className="text-sm text-red-600">{error ?? "Board not found"}</p>;
  }

  const assignedPlayerIds = new Set(
    board.buckets.flatMap((bucket) => bucket.players.map((player) => player.playerId)),
  );
  const lockInOnBoardIds = new Set([
    ...assignedPlayerIds,
    ...board.buckets.flatMap((bucket) =>
      bucket.players.map((player) => String(player.nbaPersonId)),
    ),
  ]);
  const excludedPlayerIds = showOnBoardPlayers ? undefined : assignedPlayerIds;
  const favoritePlayers = board.buckets.flatMap((bucket) =>
    bucket.players.filter((player) => player.favorited),
  );
  const favoriteRoster = resolveBoardRosterRequirements(
    tracking.roster.requirements,
    board.draftSettings,
  );
  const favoriteEvaluation = evaluateFavoriteLineup(
    favoriteRoster.requirements,
    toDraftedRosterPlayers(
      favoritePlayers.map((player) => ({
        playerId: player.playerId,
        label: player.fullName,
        positions: player.position,
      })),
    ),
    favoriteRoster.usingDefaultSlots,
  );

  const boardPane = (
    <div className="space-y-6">
      <div data-board-chrome className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              aria-label="Board name"
              onChange={(event) => setTitle(event.target.value)}
              onBlur={(event) => void saveTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveTitle(event.currentTarget.value);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setTitle(board.name);
                  setEditingTitle(false);
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none"
            />
          ) : (
            <>
              <h1 className="min-w-0 truncate text-2xl font-semibold">{board.name}</h1>
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Edit board name"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 20h4L19.5 8.5a1.5 1.5 0 0 0 0-2.12L17.62 4.5a1.5 1.5 0 0 0-2.12 0L4 16v4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm whitespace-nowrap text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Draft settings
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBrowseOpen((open) => {
                if (!open) {
                  setBrowseSnap("half");
                }
                return !open;
              });
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            aria-pressed={browseOpen}
          >
            {browseOpen ? "Hide players" : "Browse players"}
          </button>
          <button
            type="button"
            disabled={!selecting && !board.buckets.some((bucket) => bucket.players.length > 0)}
            onClick={() => {
              setSelecting((open) => {
                if (open) {
                  setSelectedIds([]);
                }
                return !open;
              });
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
            aria-pressed={selecting}
          >
            {selecting ? "Done selecting" : "Select"}
          </button>
          <button
            type="button"
            disabled={!board.buckets.some((bucket) => bucket.players.length > 0)}
            onClick={() => setResetOpen(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTitle(false);
              setTierModal("create");
            }}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create tier
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <FavoritesRosterPanel
        favorites={favoritePlayers}
        evaluation={favoriteEvaluation}
        onSelect={(player) => setSelectedPlayer(toPlayerCard(player))}
        onClear={() => void onClearFavorites()}
      />
      {board.draftSettings ? (
        <p className="text-sm text-zinc-500">
          {board.draftSettings.teamCount}-team {board.draftSettings.draftType.toLowerCase()} · pick{" "}
          {board.draftSettings.draftPosition} · {board.draftSettings.roundCount} rounds ·{" "}
          {board.draftSettings.roundTimerSeconds}s
        </p>
      ) : (
        <p className="text-sm text-zinc-500">No draft settings yet.</p>
      )}
      {selecting ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <p className="text-zinc-500">{selectedIds.length} selected</p>
          <button
            type="button"
            onClick={() =>
              setSelectedIds(
                board.buckets.flatMap((bucket) => bucket.players.map((player) => player.playerId)),
              )
            }
            className="rounded-md border border-zinc-300 px-3 py-1 dark:border-zinc-700"
          >
            Select all
          </button>
          <label className="flex items-center gap-2">
            <span className="text-zinc-500">Move to</span>
            <select
              aria-label="Move selected players to tier"
              disabled={selectedIds.length === 0}
              defaultValue=""
              onChange={(event) => {
                const bucketId = event.target.value;
                event.target.value = "";
                if (bucketId) {
                  void onBulkPlayers("move", bucketId);
                }
              }}
              className="rounded-md border border-zinc-300 bg-background px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
            >
              <option value="">Choose tier</option>
              {board.buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => void onBulkPlayers("unassign")}
            className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-50 dark:border-zinc-700"
          >
            Unassign
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              setGroupModal({ mode: "create", playerIds: selectedIds });
            }}
            className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-50 dark:border-zinc-700"
          >
            Create subcategory
          </button>
        </div>
      ) : null}

      <DraftBoardCanvas>
        <div className="space-y-3">
          {board.buckets.length === 0 ? (
            <p className="text-sm text-zinc-500">No tiers yet. Create a tier to get started.</p>
          ) : (
            board.buckets.map((bucket, index) => {
              const groupedIds = groupedPlayerIdSet(bucket.groups);
              const ungrouped = bucket.players.filter((player) => !groupedIds.has(player.playerId));
              function renderChip(player: BoardBucketPlayer, groupId: string | null) {
                return (
                  <BoardPlayerChip
                    key={player.playerId}
                    player={player}
                    bucketId={bucket.id}
                    groupId={groupId}
                    selecting={selecting}
                    selected={selectedIds.includes(player.playerId)}
                    placingPlayer={heldPlayer}
                    picked={tracking.pickedPlayerIds.has(player.playerId)}
                    userDrafted={tracking.userDraftedPlayerIds.has(player.playerId)}
                    onSelect={() => setSelectedPlayer(toPlayerCard(player))}
                    onToggleSelect={() =>
                      setSelectedIds((current) =>
                        current.includes(player.playerId)
                          ? current.filter((id) => id !== player.playerId)
                          : [...current, player.playerId],
                      )
                    }
                    onRemove={() =>
                      groupId
                        ? void onDropPlayer(bucket.id, toPlayerCard(player), undefined, null)
                        : void onRemovePlayer(player.playerId)
                    }
                    onSaveNotes={(notes) => onSaveNotes(player.playerId, notes)}
                    onToggleFavorite={() =>
                      void onToggleFavorite(player.playerId, !player.favorited)
                    }
                    onPointerDrop={applyPlayerDrop}
                    onPlaced={() => setHeldPlayer(null)}
                    onDropRelative={(dropped, side) => {
                      if (side === "before") {
                        void onDropPlayer(bucket.id, dropped, player.playerId, groupId);
                        return;
                      }
                      const afterIndex = bucket.players.findIndex(
                        (entry) => entry.playerId === player.playerId,
                      );
                      const next = bucket.players
                        .slice(afterIndex + 1)
                        .find((entry) => entry.playerId !== dropped.id);
                      void onDropPlayer(bucket.id, dropped, next?.playerId, groupId);
                    }}
                  />
                );
              }
              return (
              <BucketColumn
                key={bucket.id}
                id={bucket.id}
                name={bucket.name}
                color={nextAlternatingTierColor(index)}
                onEdit={() => {
                  setEditingTitle(false);
                  setTierModal(bucket);
                }}
                onDelete={() => void onDeleteTier(bucket.id)}
                onDropPlayer={(player, beforePlayerId) =>
                  void onDropPlayer(bucket.id, player, beforePlayerId, null)
                }
                placingPlayer={heldPlayer}
                onPlaced={() => setHeldPlayer(null)}
                onReorder={(draggedId, targetId, side) =>
                  void onReorderTiers(draggedId, targetId, side)
                }
                onCreateSubcategory={() =>
                  setGroupModal({ mode: "create", playerIds: selectedIds })
                }
              >
                {bucket.groups.map((group) => (
                  <BucketGroupBox
                    key={group.id}
                    group={group}
                    bucketId={bucket.id}
                    placingPlayer={heldPlayer}
                    onPlaced={() => setHeldPlayer(null)}
                    onEdit={() => setGroupModal({ mode: "edit", group })}
                    onDelete={() => void onDeleteGroup(group.id)}
                    onDropPlayer={(player) => void onDropPlayer(bucket.id, player, undefined, group.id)}
                  >
                    {group.playerIds
                      .map((playerId) =>
                        bucket.players.find((player) => player.playerId === playerId),
                      )
                      .filter((player): player is BoardBucketPlayer => Boolean(player))
                      .map((player) => renderChip(player, group.id))}
                  </BucketGroupBox>
                ))}
                {ungrouped.map((player) => renderChip(player, null))}
              </BucketColumn>
              );
            })
          )}
        </div>
      </DraftBoardCanvas>
    </div>
  );

  return (
    <>
      <div
        ref={splitRef}
        className={
          browseOpen
            ? "md:flex md:h-[calc(100dvh-5.5rem)] md:min-h-0 md:flex-row"
            : undefined
        }
      >
        <div
          className={browseOpen ? "md:min-h-0 md:min-w-0 md:flex-1 md:overflow-y-auto md:pr-1" : undefined}
        >
          {boardPane}
        </div>
        {browseOpen ? (
          <>
            <button
              type="button"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize player browser"
              aria-valuemin={50}
              aria-valuemax={90}
              aria-valuenow={Math.round(browseWidthPct)}
              onPointerDown={onBrowseResizePointerDown}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  setBrowseWidthFromClientX(event.clientX);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setBrowseWidthPct((current) => clampBrowseWidth(current + 2));
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setBrowseWidthPct((current) => clampBrowseWidth(current - 2));
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setBrowseWidthPct(50);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setBrowseWidthPct(90);
                }
              }}
              className="hidden w-1.5 shrink-0 cursor-col-resize self-stretch border-0 bg-zinc-200 hover:bg-zinc-400 md:block dark:bg-zinc-800 dark:hover:bg-zinc-500"
            />
            <PlayerBrowseSheet
              desktopWidthPct={browseWidthPct}
              snap={browseSnap}
              onSnap={setBrowseSnap}
              onHide={() => setBrowseOpen(false)}
            >
            <div className="mb-3 flex shrink-0 gap-1 rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
              <button
                type="button"
                aria-pressed={browseCatalog === "lock-in"}
                onClick={() => setBrowseCatalog("lock-in")}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                  browseCatalog === "lock-in"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                Lock In
              </button>
              <button
                type="button"
                aria-pressed={browseCatalog === "last-season"}
                onClick={() => setBrowseCatalog("last-season")}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                  browseCatalog === "last-season"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                Last season
              </button>
            </div>
            <label className="mb-3 flex shrink-0 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={showOnBoardPlayers}
                onChange={(event) => setShowOnBoardPlayers(event.target.checked)}
              />
              Show players already in tiers
            </label>
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {browseCatalog === "lock-in" ? (
              lockIn ? (
                <LockInExplorer
                  variant="panel"
                  draggable
                  dataset={lockIn.dataset}
                  photoIds={lockIn.photoIds}
                  directoryPlayers={lockIn.directoryPlayers}
                  injuries={lockIn.injuries}
                  onBoardPlayerIds={lockInOnBoardIds}
                  showOnBoardPlayers={showOnBoardPlayers}
                  onPointerDrop={applyPlayerDrop}
                />
              ) : (
                <p className="text-sm text-zinc-500">
                  No Lock-In dataset found. Run `pnpm scrape:statdunk` to populate this view.
                </p>
              )
            ) : (
              <PlayerDirectory
                variant="panel"
                draggable
                excludedPlayerIds={excludedPlayerIds}
                onPointerDrop={applyPlayerDrop}
              />
            )}
            </div>
            </PlayerBrowseSheet>
          </>
        ) : null}
      </div>

      {tierModal === "create" ? (
        <TierModal
          title="Create tier"
          submitLabel="Create tier"
          initialColor={nextAlternatingTierColor(board.buckets.length)}
          onClose={() => setTierModal(null)}
          onSave={onCreateTier}
        />
      ) : null}
      {tierModal && tierModal !== "create" ? (
        <TierModal
          key={tierModal.id}
          title="Edit tier"
          submitLabel="Save tier"
          initialName={tierModal.name}
          initialColor={nextAlternatingTierColor(
            board.buckets.findIndex((bucket) => bucket.id === tierModal.id),
          )}
          onClose={() => setTierModal(null)}
          onSave={(input) => onUpdateTier(tierModal, input)}
        />
      ) : null}
      {groupModal?.mode === "create" ? (
        <TierModal
          title="Create subcategory"
          submitLabel="Create subcategory"
          initialColor={nextGroupColor(uniqueBoardGroups(board.buckets).length)}
          onClose={() => setGroupModal(null)}
          onSave={onCreateGroup}
        />
      ) : null}
      {groupModal?.mode === "edit" ? (
        <TierModal
          key={groupModal.group.id}
          title="Edit subcategory"
          submitLabel="Save subcategory"
          initialName={groupModal.group.name}
          initialColor={groupModal.group.color}
          onClose={() => setGroupModal(null)}
          onSave={onUpdateGroup}
        />
      ) : null}
      {resetOpen ? (
        <ConfirmModal
          title="Reset assignments"
          description="Remove every player from this board? Tiers stay in place, and you can drag players back from the directory."
          confirmLabel="Reset board"
          onClose={() => setResetOpen(false)}
          onConfirm={onResetPlayers}
        />
      ) : null}
      {settingsOpen ? (
        <DraftSettingsModal
          title="Draft settings"
          submitLabel="Save settings"
          initialSettings={board.draftSettings}
          defaultScoring={board.draftSettings?.fantasyScoring ?? scoring}
          onClose={() => setSettingsOpen(false)}
          onSave={onSaveDraftSettings}
        />
      ) : null}
      {selectedPlayer ? (
        <PlayerModal
          player={selectedPlayer}
          scoring={board.draftSettings?.fantasyScoring ?? scoring}
          onClose={() => setSelectedPlayer(null)}
        />
      ) : null}
      {heldPlayer ? (
        <HeldPlayerTray player={heldPlayer} onCancel={() => setHeldPlayer(null)} />
      ) : null}
      <SleeperLiveTrackingBar {...tracking} />
    </>
  );
}
