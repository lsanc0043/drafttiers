"use client";

import { useEffect, useState } from "react";
import { PlayerCard, type PlayerCardData } from "@/components/players/PlayerCard";
import { PlayerModal } from "@/components/players/PlayerModal";

type PlayersResponse = {
  players: PlayerCardData[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function PlayerDirectory() {
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlayerCardData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      query,
      page: String(page),
      pageSize: "24",
      active: "true",
    });
    if (team) {
      params.set("team", team);
    }

    const controller = new AbortController();
    fetch(`/api/players?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load players");
        }
        setData((await response.json()) as PlayersResponse);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load players");
      });

    return () => controller.abort();
  }, [query, team, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 sm:max-w-sm dark:border-zinc-700"
          placeholder="Search by name"
        />
        <input
          value={team}
          onChange={(event) => {
            setPage(1);
            setTeam(event.target.value);
          }}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 sm:max-w-xs dark:border-zinc-700"
          placeholder="Team, city, or abbr"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <p className="text-sm text-zinc-500">{data ? `${data.total} players` : "Loading..."}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {data?.players.map((player) => (
          <PlayerCard key={player.id} player={player} onSelect={setSelected} />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
          disabled={!data || data.page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
          disabled={!data || data.page >= data.totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>

      {selected ? <PlayerModal player={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
