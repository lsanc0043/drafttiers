"use client";

import { useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  InjuryBadge,
  setDraggingPlayer,
  type PlayerCardData,
} from "@/components/players/PlayerCard";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import type { PlayerListQuery } from "@/lib/nba/schema";

export type DirectorySort = Exclude<PlayerListQuery["sort"], "fantasy">;

type PlayerDirectoryTableProps = {
  players: PlayerCardData[];
  sort: DirectorySort;
  sortDir: "asc" | "desc";
  showCustomColumns: boolean;
  draggable?: boolean;
  onSort: (sort: DirectorySort) => void;
  onSelect: (player: PlayerCardData) => void;
};

const BASE_COLUMNS: Array<{ key: DirectorySort; label: string }> = [
  { key: "fpts", label: "FPTS" },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "usg", label: "USG%" },
];

const CUSTOM_COLUMNS: Array<{ key: DirectorySort; label: string }> = [
  { key: "pra", label: "PRA" },
  { key: "ra", label: "RA" },
  { key: "stocks", label: "STL+BLK" },
];

function formatAvg(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(1);
}

function combo(
  player: PlayerCardData,
  keys: Array<keyof Pick<PlayerCardData, "avgPoints" | "avgRebounds" | "avgAssists" | "avgSteals" | "avgBlocks">>,
) {
  const values = keys.map((key) => player[key]);
  if (values.some((value) => value == null)) {
    return null;
  }
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function statForColumn(player: PlayerCardData, key: DirectorySort) {
  if (key === "fpts") {
    return player.avgFantasyPoints;
  }
  if (key === "pts") {
    return player.avgPoints;
  }
  if (key === "reb") {
    return player.avgRebounds;
  }
  if (key === "ast") {
    return player.avgAssists;
  }
  if (key === "stl") {
    return player.avgSteals;
  }
  if (key === "blk") {
    return player.avgBlocks;
  }
  if (key === "tov") {
    return player.avgTurnovers;
  }
  if (key === "usg") {
    return player.avgUsageRate;
  }
  if (key === "pra") {
    return combo(player, ["avgPoints", "avgRebounds", "avgAssists"]);
  }
  if (key === "ra") {
    return combo(player, ["avgRebounds", "avgAssists"]);
  }
  return combo(player, ["avgSteals", "avgBlocks"]);
}

function PlayerNameChip({
  player,
  draggable,
  onSelect,
}: {
  player: PlayerCardData;
  draggable?: boolean;
  onSelect: (player: PlayerCardData) => void;
}) {
  const didDrag = useRef(false);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);

  function onDragStart(event: DragEvent<HTMLButtonElement>) {
    didDrag.current = true;
    setDraggingPlayer(player);
    event.dataTransfer.setData("text/plain", JSON.stringify(player));
    event.dataTransfer.effectAllowed = "move";
    setPreview(null);
  }

  return (
    <>
      <button
        type="button"
        draggable={draggable}
        onClick={() => {
          if (didDrag.current) {
            didDrag.current = false;
            return;
          }
          onSelect(player);
        }}
        onDragStart={draggable ? onDragStart : undefined}
        onMouseEnter={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setPreview({ x: box.left, y: box.bottom + 8 });
        }}
        onMouseLeave={() => setPreview(null)}
        className="relative flex max-w-56 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {player.isInjured ? (
          <InjuryBadge className="!static !left-auto !top-auto shrink-0" label={player.injuryLabel} />
        ) : null}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{player.fullName}</span>
          <span className="block truncate text-xs text-zinc-500">
            {player.teamAbbr ?? player.teamName ?? "FA"} · {player.position ?? "—"}
            {player.isRookie ? (
              <>
                {" · "}
                <span className="font-semibold text-red-600">Rookie</span>
              </>
            ) : null}
          </span>
        </span>
      </button>
      {preview
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[80] rounded-xl border border-zinc-200 bg-background p-2 shadow-xl dark:border-zinc-700"
              style={{ left: preview.x, top: preview.y }}
            >
              <PlayerPhoto
                nbaPersonId={player.nbaPersonId}
                fullName={player.fullName}
                size="compact"
                photoSize={96}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function PlayerDirectoryTable({
  players,
  sort,
  sortDir,
  showCustomColumns,
  draggable,
  onSort,
  onSelect,
}: PlayerDirectoryTableProps) {
  const columns = showCustomColumns ? [...BASE_COLUMNS, ...CUSTOM_COLUMNS] : BASE_COLUMNS;

  return (
    <table className="w-full min-w-[40rem] border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-background">
        <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          <th className="bg-background px-2 py-2 font-medium">
            <button type="button" onClick={() => onSort("name")} className="hover:text-foreground">
              Player{sort === "name" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          </th>
          {columns.map((column) => (
            <th key={column.key} className="bg-background px-2 py-2 text-right font-medium">
              <button type="button" onClick={() => onSort(column.key)} className="hover:text-foreground">
                {column.label}
                {sort === column.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </button>
            </th>
          ))}
        </tr>
      </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="px-2 py-1.5">
                <PlayerNameChip player={player} draggable={draggable} onSelect={onSelect} />
              </td>
              {columns.map((column) => (
                <td key={column.key} className="px-2 py-1.5 text-right tabular-nums">
                  {formatAvg(statForColumn(player, column.key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
  );
}
