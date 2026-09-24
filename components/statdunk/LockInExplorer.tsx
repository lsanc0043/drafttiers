"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { PlayerDragGrip } from "@/components/board/PlayerDragGrip";
import {
  InjuryBadge,
  setDraggingPlayer,
  type PlayerCardData,
} from "@/components/players/PlayerCard";
import { PlayerModal } from "@/components/players/PlayerModal";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import { STICKY_TH_CLASS } from "@/components/ui/StickyTable";
import { FantasyScoringModal } from "@/components/players/FantasyScoringModal";
import { useFantasyScoring } from "@/hooks/useFantasyScoring";
import { useCoarsePointer } from "@/hooks/useCoarsePointer";
import type { PlayerDropDest } from "@/lib/board-drop-target";
import { teamTagStyle } from "@/lib/nba/team-colors";
import type { InjuryLabel } from "@/lib/nba/injuries";
import {
  lockInBoxStats,
  lockInUsageByTeam,
  type LockInBoxStats,
} from "@/lib/statdunk/box-stats";
import type {
  StatdunkLockInDataset,
  StatdunkNormalizedPlayer,
} from "@/lib/statdunk/types";

const FANTASY_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

type SortKey =
  | "expectedFptsPerActiveWeekRank"
  | "expectedFptsPerActiveWeek"
  | "playerName"
  | "gamesPlayed"
  | "min"
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "usg"
  | "fgm"
  | "fga"
  | "fgPct"
  | "ftm"
  | "fta"
  | "ftPct"
  | "tpm"
  | "tpa";

type LockInInjury = {
  label: InjuryLabel;
  url: string | null;
};

type LockInExplorerProps = {
  dataset: StatdunkLockInDataset;
  photoIds?: Record<string, number>;
  injuries?: Record<string, LockInInjury>;
  directoryPlayers?: Record<string, PlayerCardData>;
  variant?: "page" | "panel";
  draggable?: boolean;
  onPointerDrop?: (player: PlayerCardData, dest: PlayerDropDest) => void;
  onBoardPlayerIds?: ReadonlySet<string>;
  showOnBoardPlayers?: boolean;
};

type LockInRow = StatdunkNormalizedPlayer &
  LockInBoxStats & {
    rowKey: string;
    positions: string[];
    injury: LockInInjury | null;
    isRookie: boolean;
    card: PlayerCardData | null;
  };

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function isOnBoardPlayer(
  player: LockInRow,
  onBoardPlayerIds: ReadonlySet<string> | undefined,
  photoIds: Record<string, number>,
) {
  if (!onBoardPlayerIds?.size) {
    return false;
  }
  return Boolean(
    (player.card && onBoardPlayerIds.has(player.card.id)) ||
      (photoIds[player.rowKey] != null &&
        onBoardPlayerIds.has(String(photoIds[player.rowKey]))) ||
      (player.card?.nbaPersonId != null &&
        onBoardPlayerIds.has(String(player.card.nbaPersonId))),
  );
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function playerKey(player: StatdunkNormalizedPlayer) {
  return (
    player.canonicalPlayerId ??
    player.sleeperPlayerId ??
    player.playerName ??
    "unknown"
  );
}

function splitPositions(player: StatdunkNormalizedPlayer): string[] {
  const raw = player.fantasyPositions.length
    ? player.fantasyPositions
    : player.position
      ? [player.position]
      : [];
  const values = new Set<string>();
  for (const item of raw) {
    for (const part of item.split(/[/,]/)) {
      const position = part.trim().toUpperCase();
      if (position) {
        values.add(position);
      }
    }
  }
  return [...values];
}

function toCard(
  player: StatdunkNormalizedPlayer,
  rowKey: string,
  positions: string[],
  injury: LockInInjury | null,
  directoryPlayers: Record<string, PlayerCardData>,
  photoIds: Record<string, number>,
): PlayerCardData | null {
  const fromDirectory = directoryPlayers[rowKey];
  if (fromDirectory) {
    return {
      ...fromDirectory,
      isInjured: injury != null,
      injuryLabel: injury?.label ?? fromDirectory.injuryLabel,
      injuryUrl: injury?.url ?? fromDirectory.injuryUrl,
    };
  }
  const nbaPersonId = photoIds[rowKey];
  if (nbaPersonId == null) {
    return null;
  }
  return {
    id: String(nbaPersonId),
    nbaPersonId,
    fullName: player.playerName ?? "Unknown",
    teamAbbr: player.team,
    teamName: player.team,
    position: positions.join("/") || null,
    jerseyNumber: null,
    isActive: true,
    isRookie: false,
    isInjured: injury != null,
    injuryLabel: injury?.label ?? null,
    injuryUrl: injury?.url ?? null,
  };
}

function compare(
  left: LockInRow,
  right: LockInRow,
  key: SortKey,
  dir: "asc" | "desc",
) {
  const a = left[key];
  const b = right[key];
  const empty =
    dir === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  let result = 0;
  if (typeof a === "number" || typeof b === "number") {
    result =
      (typeof a === "number" ? a : empty) - (typeof b === "number" ? b : empty);
  } else {
    result = String(a ?? "").localeCompare(String(b ?? ""), undefined, {
      sensitivity: "base",
    });
  }
  return dir === "asc" ? result : -result;
}

const BASE_COLUMNS: Array<{ key: SortKey; label: string; digits: number }> = [
  { key: "expectedFptsPerActiveWeekRank", label: "#", digits: 0 },
  { key: "playerName", label: "Player", digits: 0 },
  { key: "expectedFptsPerActiveWeek", label: "FPTS/week", digits: 3 },
  { key: "gamesPlayed", label: "GP", digits: 1 },
  { key: "min", label: "MIN", digits: 1 },
  { key: "pts", label: "PTS", digits: 1 },
  { key: "reb", label: "REB", digits: 1 },
  { key: "ast", label: "AST", digits: 1 },
  { key: "stl", label: "STL", digits: 1 },
  { key: "blk", label: "BLK", digits: 1 },
  { key: "tov", label: "TO", digits: 1 },
  { key: "usg", label: "USG%", digits: 1 },
];

const SHOOTING_COLUMNS: Array<{ key: SortKey; label: string; digits: number }> =
  [
    { key: "fgm", label: "FG", digits: 1 },
    { key: "fga", label: "FGA", digits: 1 },
    { key: "fgPct", label: "FG%", digits: 1 },
    { key: "ftm", label: "FT", digits: 1 },
    { key: "fta", label: "FTA", digits: 1 },
    { key: "ftPct", label: "FT%", digits: 1 },
    { key: "tpm", label: "3P", digits: 1 },
    { key: "tpa", label: "3PM", digits: 1 },
  ];

export function LockInExplorer({
  dataset,
  photoIds = {},
  injuries = {},
  directoryPlayers = {},
  variant = "page",
  draggable = false,
  onPointerDrop,
  onBoardPlayerIds,
  showOnBoardPlayers = false,
}: LockInExplorerProps) {
  const isPanel = variant === "panel";
  const coarse = useCoarsePointer();
  const { scoring, update } = useFantasyScoring();
  const didDrag = useRef(false);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("all");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showShooting, setShowShooting] = useState(false);
  const [sort, setSort] = useState<SortKey>("expectedFptsPerActiveWeekRank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<PlayerCardData | null>(null);
  const [selectedSleeperId, setSelectedSleeperId] = useState<string | null>(
    null,
  );
  const [scoringOpen, setScoringOpen] = useState(false);

  const teams = useMemo(() => {
    return [
      ...new Set(
        dataset.players
          .map((player) => player.team)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort();
  }, [dataset.players]);

  const teamUsage = useMemo(
    () => lockInUsageByTeam(dataset.players),
    [dataset.players],
  );

  const columns = showShooting
    ? [...BASE_COLUMNS, ...SHOOTING_COLUMNS]
    : BASE_COLUMNS;

  const rows = useMemo(() => {
    const query = fold(search.trim());
    const enriched: LockInRow[] = dataset.players.map((player) => {
      const rowKey = playerKey(player);
      const positions = splitPositions(player);
      const injury = injuries[rowKey] ?? null;
      const card = toCard(
        player,
        rowKey,
        positions,
        injury,
        directoryPlayers,
        photoIds,
      );
      return {
        ...player,
        ...lockInBoxStats(player, teamUsage),
        rowKey,
        positions,
        injury,
        isRookie: card?.isRookie ?? false,
        card,
      };
    });

    return enriched
      .filter((player) => {
        if (team !== "all" && player.team !== team) {
          return false;
        }
        if (selectedPositions.length > 0) {
          const matches = selectedPositions.some((position) =>
            player.positions.includes(position),
          );
          if (!matches) {
            return false;
          }
        }
        if (
          !showOnBoardPlayers &&
          isOnBoardPlayer(player, onBoardPlayerIds, photoIds)
        ) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = fold(
          [player.playerName, player.team, player.positions.join(" ")]
            .filter(Boolean)
            .join(" "),
        );
        return haystack.includes(query);
      })
      .sort((left, right) => compare(left, right, sort, sortDir));
  }, [
    dataset.players,
    directoryPlayers,
    injuries,
    onBoardPlayerIds,
    photoIds,
    search,
    selectedPositions,
    showOnBoardPlayers,
    sort,
    sortDir,
    team,
    teamUsage,
  ]);

  function onSort(key: SortKey) {
    if (sort === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(key);
    setSortDir(
      key === "playerName" || key === "expectedFptsPerActiveWeekRank"
        ? "asc"
        : "desc",
    );
  }

  function togglePosition(position: string) {
    setSelectedPositions((current) =>
      current.includes(position)
        ? current.filter((value) => value !== position)
        : [...current, position],
    );
  }

  function openPlayer(row: LockInRow) {
    if (!row.card) {
      return;
    }
    setSelectedSleeperId(row.sleeperPlayerId);
    setSelected(row.card);
  }

  function onDragStart(event: DragEvent<HTMLButtonElement>, row: LockInRow) {
    if (!row.card) {
      event.preventDefault();
      return;
    }
    didDrag.current = true;
    setDraggingPlayer(row.card);
    event.dataTransfer.setData("text/plain", JSON.stringify(row.card));
    event.dataTransfer.effectAllowed = "move";
  }

  const publicationLabel =
    typeof dataset.publication?.label === "string"
      ? dataset.publication.label
      : "StatDunk Lock-In";
  const season =
    typeof dataset.publication?.targetSeason === "string"
      ? dataset.publication.targetSeason
      : null;
  const asOf =
    typeof dataset.publication?.asOf === "string"
      ? dataset.publication.asOf
      : null;

  return (
    <div
      className={isPanel ? "flex h-full min-h-0 flex-col gap-3 overflow-hidden" : "space-y-4"}
    >
      {isPanel ? null : (
        <p className="text-sm text-zinc-500">
          {publicationLabel}
          {season ? ` · ${season}` : ""}
          {asOf ? ` · as of ${asOf}` : ""}
          {` · ${dataset.players.length} players`}
        </p>
      )}

      <div
        className={`flex flex-wrap items-end gap-3 ${isPanel ? "shrink-0" : ""}`}
      >
        <label className="min-w-[16rem] flex-1 text-sm">
          <span className="mb-1 block text-zinc-500">Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, team, position"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Team</span>
          <select
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          >
            <option value="all">All teams</option>
            {teams.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={showShooting}
            onChange={(event) => setShowShooting(event.target.checked)}
          />
          Shooting stats
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Positions</span>
        {FANTASY_POSITIONS.map((position) => {
          const active = selectedPositions.includes(position);
          return (
            <button
              key={position}
              type="button"
              onClick={() => togglePosition(position)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {position}
            </button>
          );
        })}
        {selectedPositions.length > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedPositions([])}
            className="text-xs text-zinc-500 underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p className={`text-sm text-zinc-500 ${isPanel ? "shrink-0" : ""}`}>
        {rows.length} shown
        {isPanel ? ` · ${publicationLabel}` : ""}
      </p>

      <div
        className={
          isPanel
            ? "min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-zinc-200 dark:border-zinc-800"
            : "max-h-[min(75dvh,52rem)] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800"
        }
      >
        <table className="w-full min-w-5xl border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-500">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${STICKY_TH_CLASS} py-2 font-medium ${
                    column.key === "expectedFptsPerActiveWeekRank"
                      ? "w-8 px-1 text-right"
                      : column.key === "playerName"
                        ? "w-46 max-w-46 px-1.5 text-left"
                        : "px-2 text-right"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="hover:text-foreground"
                  >
                    {column.label}
                    {sort === column.key
                      ? sortDir === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => {
              const style = teamTagStyle(player.team);
              const onBoard = isOnBoardPlayer(
                player,
                onBoardPlayerIds,
                photoIds,
              );
              return (
                <tr
                  key={player.rowKey}
                  className={`border-b border-zinc-100 dark:border-zinc-900 ${
                    onBoard ? "opacity-40 grayscale" : ""
                  }`}
                >
                  <td className="w-8 px-1 py-2 text-right text-xs tabular-nums text-zinc-500">
                    {formatNumber(player.expectedFptsPerActiveWeekRank, 0)}
                  </td>
                  <td className="w-46 max-w-46 px-1.5 py-1.5">
                    <div className="flex items-center gap-1">
                    <button
                      type="button"
                      draggable={draggable && !coarse && Boolean(player.card)}
                      onClick={() => {
                        if (didDrag.current) {
                          didDrag.current = false;
                          return;
                        }
                        openPlayer(player);
                      }}
                      onDragStart={
                        draggable && !coarse
                          ? (event) => onDragStart(event, player)
                          : undefined
                      }
                      className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <PlayerPhoto
                        nbaPersonId={photoIds[player.rowKey] ?? null}
                        fullName={player.playerName ?? "Unknown"}
                        size="compact"
                        photoSize={40}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-sm font-medium group-hover:underline">
                            {player.playerName ?? "Unknown"}
                          </span>
                          {player.isRookie ? (
                            <span className="shrink-0 text-[10px] font-bold text-red-600">
                              Rookie
                            </span>
                          ) : null}
                          {player.injury ? (
                            <InjuryBadge
                              className="static! left-auto! top-auto! shrink-0"
                              href={player.injury.url}
                              label={player.injury.label}
                            />
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                          <span
                            className="rounded border px-1 py-px text-[10px] font-semibold tracking-wide"
                            style={style}
                          >
                            {player.team ?? "—"}
                          </span>
                          {player.positions.map((position) => (
                            <span
                              key={position}
                              className="rounded border border-zinc-300 px-1 py-px text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              {position}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                    {coarse && draggable && player.card ? (
                      <PlayerDragGrip player={player.card} onDrop={onPointerDrop} />
                    ) : null}
                    </div>
                  </td>
                  {columns.slice(2).map((column) => (
                    <td
                      key={column.key}
                      className="px-2 py-2 text-right tabular-nums"
                    >
                      {formatNumber(
                        player[column.key] as number | null,
                        column.digits,
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected ? (
        <PlayerModal
          player={selected}
          scoring={scoring}
          sleeperPlayerId={selectedSleeperId}
          onEditScoring={() => setScoringOpen(true)}
          onClose={() => {
            setSelected(null);
            setSelectedSleeperId(null);
          }}
        />
      ) : null}
      {scoringOpen ? (
        <FantasyScoringModal
          scoring={scoring}
          onSave={(next) => {
            update(next);
          }}
          onClose={() => setScoringOpen(false)}
        />
      ) : null}
    </div>
  );
}
