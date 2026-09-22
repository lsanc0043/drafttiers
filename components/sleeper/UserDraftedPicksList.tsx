"use client";

export type UserDraftedPick = {
  pickNo: number;
  name: string;
  position: string;
  onBoard: boolean;
};

type UserDraftedPicksListProps = {
  picks: UserDraftedPick[];
};

export function UserDraftedPicksList({ picks }: UserDraftedPicksListProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold tracking-wide">Your picks</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {picks.length} player{picks.length === 1 ? "" : "s"} · includes players not on the board
      </p>
      <ul className="mt-3 max-h-72 min-h-0 flex-1 overflow-y-auto pr-1">
        {picks.length === 0 ? (
          <li className="text-sm text-zinc-500">No picks for your slot yet.</li>
        ) : (
          picks.map((pick) => (
            <li
              key={`${pick.pickNo}-${pick.name}`}
              className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-1.5 text-sm last:border-b-0 dark:border-zinc-900"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 text-zinc-500">#{pick.pickNo}</span>
                <span className="font-medium">{pick.name}</span>
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {pick.position || "—"}
                {pick.onBoard ? "" : " · off board"}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
