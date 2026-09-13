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
  isInjured?: boolean;
  injuryLabel?: "GTD" | "OUT" | null;
  injuryUrl?: string | null;
};

export function InjuryBadge({
  className = "",
  href,
  label,
}: {
  className?: string;
  href?: string | null;
  label?: "GTD" | "OUT" | null;
}) {
  const text = label ?? "GTD";
  const colorClass = text === "OUT" ? "bg-red-600 hover:bg-red-500" : "bg-amber-500 hover:bg-amber-400";
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

type PlayerCardProps = {
  player: PlayerCardData;
  onSelect: (player: PlayerCardData) => void;
};

export function PlayerCard({ player, onSelect }: PlayerCardProps) {
  const team = player.teamAbbr ?? player.teamName ?? "FA";
  const position = player.position ?? "—";

  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      className="relative flex w-full flex-col items-center rounded-xl border border-zinc-200 bg-background px-3 py-4 text-center transition duration-200 hover:-translate-y-1 hover:border-zinc-400 hover:shadow-lg dark:border-zinc-800 dark:hover:border-zinc-500"
    >
      {player.isInjured ? <InjuryBadge label={player.injuryLabel} /> : null}
      <PlayerPhoto
        nbaPersonId={player.nbaPersonId}
        fullName={player.fullName}
        size="card"
      />
      <p className="mt-3 w-full truncate text-sm font-semibold">
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
