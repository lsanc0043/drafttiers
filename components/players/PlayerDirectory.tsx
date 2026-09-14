"use client";

import { useEffect, useRef, useState } from "react";
import { FantasyScoringModal } from "@/components/players/FantasyScoringModal";
import {
  PlayerCard,
  type PlayerCardData,
} from "@/components/players/PlayerCard";
import {
  PlayerDirectoryTable,
  type DirectorySort,
} from "@/components/players/PlayerDirectoryTable";
import { PlayerModal } from "@/components/players/PlayerModal";
import { useFantasyScoring } from "@/hooks/useFantasyScoring";

type PlayersResponse = {
  players: PlayerCardData[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type DirectoryView = "grid" | "list";

type PlayerDirectoryProps = {
  variant?: "page" | "panel";
  draggable?: boolean;
  excludedPlayerIds?: ReadonlySet<string>;
};

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500"
      role="status"
    >
      <svg
        className="h-5 w-5 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function mergePlayers(current: PlayerCardData[], incoming: PlayerCardData[]) {
  const seen = new Set(current.map((player) => player.id));
  const next = [...current];
  for (const player of incoming) {
    if (seen.has(player.id)) {
      continue;
    }
    seen.add(player.id);
    next.push(player);
  }
  return next;
}

export function PlayerDirectory({
  variant = "page",
  draggable = false,
  excludedPlayerIds,
}: PlayerDirectoryProps) {
  const isPanel = variant === "panel";
  const [view, setView] = useState<DirectoryView>(isPanel ? "list" : "grid");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [sort, setSort] = useState<DirectorySort>("fpts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showCustomColumns, setShowCustomColumns] = useState(false);
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [players, setPlayers] = useState<PlayerCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlayerCardData | null>(null);
  const [scoringOpen, setScoringOpen] = useState(false);
  const { scoring, update } = useFantasyScoring();
  const pageSize = isPanel ? 30 : 25;
  const loadingRef = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  function beginLoad() {
    loadingRef.current = true;
    setLoading(true);
  }

  function resetList() {
    beginLoad();
    setPage(1);
  }

  function onSort(next: DirectorySort) {
    resetList();
    if (next === sort) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSort(next);
    setSortDir(next === "name" ? "asc" : "desc");
  }

  useEffect(() => {
    const controller = new AbortController();
    const requestedPage = page;
    loadingRef.current = true;

    const params = new URLSearchParams({
      query: query.trim(),
      page: String(requestedPage),
      pageSize: String(pageSize),
      active: "true",
      sort,
      sortDir,
    });
    if (team) {
      params.set("team", team);
    }
    if (rookiesOnly) {
      params.set("rookies", "true");
    }
    params.set("scoring", JSON.stringify(scoring));

    void fetch(`/api/players?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load players");
        }
        const payload = (await response.json()) as PlayersResponse;
        if (controller.signal.aborted) {
          return;
        }
        setPlayers((current) =>
          requestedPage === 1
            ? payload.players
            : mergePlayers(current, payload.players),
        );
        setTotal(payload.total);
        setTotalPages(payload.totalPages);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load players",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [query, team, page, pageSize, sort, sortDir, scoring, rookiesOnly]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) {
          return;
        }
        setPage((current) => {
          if (current >= totalPages) {
            return current;
          }
          loadingRef.current = true;
          return current + 1;
        });
      },
      {
        root: scrollRootRef.current,
        rootMargin: "240px",
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isPanel, totalPages, players.length]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) {
      return;
    }
    function onScroll() {
      if (scrollRoot) {
        setShowBackToTop(scrollRoot.scrollTop > 240);
      }
    }
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, [isPanel, players.length]);

  const visiblePlayers = players.filter(
    (player) => !excludedPlayerIds?.has(player.id),
  );
  const hiddenCount = excludedPlayerIds?.size ?? 0;
  const hasMore = page < totalPages;

  return (
    <div
      className={isPanel ? "flex h-full min-h-0 flex-col gap-4" : "space-y-4"}
    >
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${isPanel ? "shrink-0" : ""}`}
      >
        <input
          value={query}
          onChange={(event) => {
            resetList();
            setQuery(event.target.value);
          }}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 sm:max-w-sm dark:border-zinc-700"
          placeholder="Search by name"
        />
        <input
          value={team}
          onChange={(event) => {
            resetList();
            setTeam(event.target.value);
          }}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 sm:max-w-xs dark:border-zinc-700"
          placeholder="Team, city, or abbr"
        />
        <button
          type="button"
          onClick={() => setScoringOpen(true)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm whitespace-nowrap dark:border-zinc-700"
        >
          Fantasy scoring
        </button>
        <button
          type="button"
          aria-pressed={rookiesOnly}
          onClick={() => {
            resetList();
            setRookiesOnly((open) => !open);
          }}
          className={`rounded-md border px-3 py-2 text-sm whitespace-nowrap dark:border-zinc-700 ${
            rookiesOnly
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300"
          }`}
        >
          Rookies
        </button>
        {view === "list" ? (
          <button
            type="button"
            aria-pressed={showCustomColumns}
            onClick={() => setShowCustomColumns((open) => !open)}
            className={`rounded-md border px-3 py-2 text-sm whitespace-nowrap dark:border-zinc-700 ${
              showCustomColumns
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300"
            }`}
          >
            Custom columns
          </button>
        ) : (
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <span className="text-zinc-500">Sort</span>
            <select
              aria-label="Sort players"
              value={sort}
              onChange={(event) => {
                const next = event.target.value as DirectorySort;
                resetList();
                setSort(next);
                setSortDir(next === "name" ? "asc" : "desc");
              }}
              className="rounded-md border border-zinc-300 bg-background px-2 py-2 dark:border-zinc-700"
            >
              <option value="fpts">FPTS</option>
              <option value="pts">PTS</option>
              <option value="reb">REB</option>
              <option value="ast">AST</option>
              <option value="stl">STL</option>
              <option value="blk">BLK</option>
              <option value="tov">TOV</option>
              <option value="usg">USG%</option>
              <option value="name">Name</option>
            </select>
          </label>
        )}
        <div className="flex rounded-md border border-zinc-300 dark:border-zinc-700">
          <button
            type="button"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`rounded-l-md px-3 py-2 text-sm ${
              view === "grid"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : ""
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`rounded-r-md px-3 py-2 text-sm ${
              view === "list"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : ""
            }`}
          >
            List
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className={`text-sm text-zinc-500 ${isPanel ? "shrink-0" : ""}`}>
        {loading && players.length === 0
          ? "Loading..."
          : `${Math.max(0, total - hiddenCount)} ${rookiesOnly ? "rookies" : "players"} · 2025-26 averages`}
      </p>
      <div
        className={
          isPanel
            ? "relative min-h-0 flex-1"
            : "relative h-[calc(100dvh-14rem)] min-h-80"
        }
      >
        <div ref={scrollRootRef} className="h-full overflow-auto pr-1">
          {loading && players.length === 0 ? (
            <LoadingSpinner label="Loading players" />
          ) : view === "list" ? (
            <PlayerDirectoryTable
              players={visiblePlayers}
              sort={sort}
              sortDir={sortDir}
              showCustomColumns={showCustomColumns}
              draggable={draggable}
              onSort={onSort}
              onSelect={setSelected}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {visiblePlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  draggable={draggable}
                  onSelect={setSelected}
                />
              ))}
            </div>
          )}
          <div ref={sentinelRef}>
            {hasMore || (loading && players.length > 0) ? (
              <LoadingSpinner label="Loading more players" />
            ) : null}
          </div>
        </div>
        {showBackToTop ? (
          <button
            type="button"
            onClick={() =>
              scrollRootRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            }
            className="absolute right-3 bottom-3 z-20 rounded-full border border-zinc-300 bg-background px-3 py-2 text-sm shadow-lg dark:border-zinc-700"
          >
            Back to top
          </button>
        ) : null}
      </div>

      {selected ? (
        <PlayerModal
          player={selected}
          scoring={scoring}
          onEditScoring={() => setScoringOpen(true)}
          onClose={() => setSelected(null)}
        />
      ) : null}
      {scoringOpen ? (
        <FantasyScoringModal
          scoring={scoring}
          onSave={(next) => {
            beginLoad();
            setPage(1);
            update(next);
          }}
          onClose={() => setScoringOpen(false)}
        />
      ) : null}
    </div>
  );
}
