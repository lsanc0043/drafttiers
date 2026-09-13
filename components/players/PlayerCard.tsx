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
};

function TeamPosition({
  team,
  position,
  isRookie,
  className,
}: {
  team: string;
  position: string;
  isRookie: boolean;
  className: string;
}) {
  return (
    <p className={className}>
      {team} · {position}
      {isRookie ? (
        <span>
          {" ·"}
          <span className="ml-1 font-bold text-red-600" title="Rookie">
            Rookie
          </span>
        </span>
      ) : null}
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
      className="flex w-full flex-col items-center rounded-xl border border-zinc-200 bg-background px-3 py-4 text-center transition duration-200 hover:-translate-y-1 hover:border-zinc-400 hover:shadow-lg dark:border-zinc-800 dark:hover:border-zinc-500"
    >
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
        className="mt-1 text-xs text-zinc-300"
      />
    </button>
  );
}
