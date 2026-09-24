"use client";

import { useEffect, useState } from "react";
import { InjuryBadge, type PlayerCardData } from "@/components/players/PlayerCard";
import { PlayerPhoto } from "@/components/players/PlayerPhoto";
import {
  DEPTH_LABELS,
  STARTING_FIVE_SLOTS,
  type LockInDepthChartRow,
  type LockInStartingFivePlayer,
  type StartingFiveSlot,
} from "@/lib/statdunk/starting-five";

type PlayerTeamTabProps = {
  player: PlayerCardData;
  onSelect: (player: PlayerCardData) => void;
};

type RosterResponse = {
  team?: string;
  teamName?: string;
  season?: string;
  depthChart?: LockInDepthChartRow[];
  error?: string;
};

const SLOT_BADGE_CLASS: Record<StartingFiveSlot, string> = {
  PG: "bg-red-600 text-white",
  SG: "bg-orange-500 text-white",
  SF: "bg-green-600 text-white",
  PF: "bg-blue-600 text-white",
  C: "bg-purple-600 text-white",
};

function formatAvg(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(1);
}

function isCurrentPlayer(cell: LockInStartingFivePlayer, current: PlayerCardData) {
  const card = cell.player;
  if (card?.id && card.id === current.id) {
    return true;
  }
  if (cell.nbaPersonId && current.nbaPersonId && cell.nbaPersonId === current.nbaPersonId) {
    return true;
  }
  return cell.fullName === current.fullName;
}

function DepthCell({
  cell,
  current,
  onSelect,
}: {
  cell: LockInStartingFivePlayer | null;
  current: PlayerCardData;
  onSelect: (player: PlayerCardData) => void;
}) {
  if (!cell) {
    return <span className="text-zinc-400">—</span>;
  }
  const card = cell.player;
  const selected = isCurrentPlayer(cell, current);
  const content = (
    <>
      <PlayerPhoto
        nbaPersonId={cell.nbaPersonId}
        fullName={cell.fullName}
        size="compact"
        photoSize={36}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1">
          <span className={`truncate ${selected ? "font-semibold" : "font-medium"}`}>
            {cell.fullName}
          </span>
          {card?.isInjured ? (
            <InjuryBadge
              className="!static !left-auto !top-auto shrink-0"
              href={card.injuryUrl}
              label={card.injuryLabel}
            />
          ) : null}
        </span>
        <span className="block text-[11px] tabular-nums text-zinc-500">
          {formatAvg(cell.minutes)} min
        </span>
      </span>
    </>
  );
  const className = `flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left ${
    selected
      ? "bg-zinc-200 ring-2 ring-zinc-900 dark:bg-zinc-800 dark:ring-zinc-100"
      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
  }`;
  if (!card) {
    return <div className={className}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      className={className}
      aria-current={selected ? "true" : undefined}
    >
      {content}
    </button>
  );
}

export function PlayerTeamTab({ player, onSelect }: PlayerTeamTabProps) {
  const [depthChart, setDepthChart] = useState<LockInDepthChartRow[] | null>(null);
  const [seasonLabel, setSeasonLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (player.nbaPersonId) {
      params.set("nbaPersonId", String(player.nbaPersonId));
    }
    if (player.fullName) {
      params.set("name", player.fullName);
    }
    setDepthChart(null);
    setSeasonLabel(null);
    setError(null);
    fetch(`/api/lock-in/roster?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as RosterResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load 2026-27 roster");
        }
        setSeasonLabel(payload.season ?? "2026-27");
        setDepthChart(payload.depthChart ?? []);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load team");
      });
    return () => controller.abort();
  }, [player.fullName, player.nbaPersonId]);

  if (error) {
    return <p className="mt-2 text-sm text-red-600">{error}</p>;
  }
  if (!depthChart) {
    return <p className="mt-2 text-sm text-zinc-500">Loading 2026-27 roster...</p>;
  }
  if (depthChart.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">No 2026-27 teammates found.</p>;
  }

  const rows = STARTING_FIVE_SLOTS.map(
    (slot) => depthChart.find((row) => row.slot === slot) ?? { slot, depth: [null, null, null] },
  );

  return (
    <div className="mt-2 md:min-h-0 md:flex-1 md:overflow-auto">
      <p className="mb-2 text-xs text-zinc-500">
        {seasonLabel ?? "2026-27"} Lock-In depth by projected minutes
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-xl border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-500">
              <th className="w-14 py-2 pr-2 font-medium">Pos</th>
              {DEPTH_LABELS.map((label) => (
                <th key={label} className="py-2 pr-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slot}>
                <th className="border-t border-zinc-200 px-2 py-3 align-middle dark:border-zinc-800">
                  <span
                    className={`inline-flex min-w-8 justify-center rounded px-1.5 py-0.5 text-xs font-bold tracking-wide ${SLOT_BADGE_CLASS[row.slot]}`}
                  >
                    {row.slot}
                  </span>
                </th>
                {DEPTH_LABELS.map((_, index) => (
                  <td
                    key={`${row.slot}-${index}`}
                    className="border-t border-zinc-200 px-1 py-2 align-middle dark:border-zinc-800"
                  >
                    <DepthCell
                      cell={row.depth[index] ?? null}
                      current={player}
                      onSelect={onSelect}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
