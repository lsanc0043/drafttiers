"use client";

import { PlayerPhoto } from "@/components/players/PlayerPhoto";

export type PlayerCardData = {
  id: string;
  nbaPersonId: number;
  fullName: string;
  teamAbbr: string | null;
  teamName: string | null;
  position: string | null;
  jerseyNumber: string | null;
  isActive: boolean;
  isRookie: boolean;
  avgFantasyPoints?: number | null;
  avgPoints?: number | null;
  avgRebounds?: number | null;
  avgAssists?: number | null;
  avgSteals?: number | null;
  avgBlocks?: number | null;
  avgTurnovers?: number | null;
  avgUsageRate?: number | null;
  isInjured?: boolean;
  injuryLabel?: "GTD" | "DTD" | "OUT" | null;
  injuryUrl?: string | null;
};

export function InjuryBadge({
  className = "",
  href,
  label,
}: {
  className?: string;
  href?: string | null;
  label?: "GTD" | "DTD" | "OUT" | null;
}) {
  const text = label ?? "GTD";
  const colorClass =
    text === "OUT"
      ? "bg-red-600 hover:bg-red-500"
      : text === "DTD"
        ? "bg-orange-500 hover:bg-orange-400"
        : "bg-amber-500 hover:bg-amber-400";
  const badgeClass = `absolute left-2 top-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${colorClass} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={badgeClass}
        title={`View ${text} injury report`}
        onClick={(event) => event.stopPropagation()}
      >
        {text}
      </a>
    );
  }

  return (
    <span className={`${badgeClass} pointer-events-none`} title={text}>
      {text}
    </span>
  );
}

function formatAvgFantasyPoints(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(1) + " fpts";
}

function TeamPosition({
  team,
  position,
  isRookie,
  avgFantasyPoints,
}: {
  team: string;
  position: string;
  isRookie: boolean;
  avgFantasyPoints: number | null | undefined;
}) {
  return (
    <p className="mt-1 w-full truncate text-xs text-zinc-300">
      {isRookie ? (
        <span className="font-bold text-red-600" title="Rookie">
          Rookie
        </span>
      ) : null}
      {isRookie ? " · " : null}
      {team} · {position}
      <span
        className="ml-2 tabular-nums text-zinc-200"
        title="Average fantasy points"
      >
        {formatAvgFantasyPoints(avgFantasyPoints)}
      </span>
    </p>
  );
}

export const CATALOG_PLAYER_DRAG_TYPE = "application/x-drafttiers-player";

let draggingPlayer: PlayerCardData | null = null;

export function setDraggingPlayer(player: PlayerCardData | null) {
  draggingPlayer = player;
}

export function peekDraggingPlayer() {
  return draggingPlayer;
}

export function takeDraggingPlayer() {
  const player = draggingPlayer;
  draggingPlayer = null;
  return player;
}

type PlayerCardProps = {
  player: PlayerCardData;
  onSelect: (player: PlayerCardData) => void;
  draggable?: boolean;
  photoSize?: number;
};

export function PlayerCard({ player, onSelect, draggable = false, photoSize }: PlayerCardProps) {
  const team = player.teamAbbr ?? player.teamName ?? "FA";
  const position = player.position ?? "—";
  const compact = photoSize != null && photoSize < 80;

  return (
    <button
      type="button"
      draggable={draggable}
      onClick={() => onSelect(player)}
      onDragStart={
        draggable
          ? (event) => {
              draggingPlayer = player;
              event.dataTransfer.setData(CATALOG_PLAYER_DRAG_TYPE, JSON.stringify(player));
              event.dataTransfer.setData("text/plain", JSON.stringify(player));
              event.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      className={`relative flex w-full flex-col items-center rounded-xl border border-zinc-200 bg-background text-center transition duration-200 hover:-translate-y-1 hover:border-zinc-400 hover:shadow-lg dark:border-zinc-800 dark:hover:border-zinc-500 ${
        compact ? "px-2 py-3" : "px-3 py-4"
      }`}
    >
      {player.isInjured ? <InjuryBadge label={player.injuryLabel} /> : null}
      <PlayerPhoto
        nbaPersonId={player.nbaPersonId}
        fullName={player.fullName}
        size={photoSize != null ? "compact" : "card"}
        photoSize={photoSize}
      />
      <p className={`mt-3 w-full truncate font-semibold ${compact ? "text-xs" : "text-sm"}`}>
        {player.fullName.toLocaleUpperCase()}
      </p>
      <TeamPosition
        team={team}
        position={position}
        isRookie={player.isRookie}
        avgFantasyPoints={player.avgFantasyPoints}
      />
    </button>
  );
}
