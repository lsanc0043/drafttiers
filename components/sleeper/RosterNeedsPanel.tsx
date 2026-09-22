"use client";

import type { RosterState } from "@/lib/sleeper/roster";

const STATUS_LABEL: Record<string, string> = {
  fulfilled: "✓ Fulfilled",
  needed: "! Needed",
  at_risk: "⚠ At Risk",
};

type RosterNeedsPanelProps = {
  roster: RosterState;
  hasUser: boolean;
  preDraft: boolean;
};

function PositionHover({ label, players }: { label: string; players: string[] }) {
  return (
    <span className="group relative inline-flex cursor-default">
      <span className="font-medium underline decoration-dotted decoration-zinc-400 underline-offset-4">
        {label}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-max max-w-56 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-normal text-zinc-800 shadow-md group-hover:visible group-focus-within:visible dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {players.length > 0 ? players.join(", ") : "No players yet"}
      </span>
    </span>
  );
}

export function RosterNeedsPanel({ roster, hasUser, preDraft }: RosterNeedsPanelProps) {
  return (
    <section className="overflow-visible rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold tracking-wide">
        {preDraft && roster.filledRosterSpots === 0 ? "Roster configuration" : "Roster needs"}
      </h2>
      {preDraft && roster.filledRosterSpots === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">No players drafted yet.</p>
      ) : null}
      {!hasUser ? (
        <p className="mt-1 text-xs text-zinc-500">
          Enter your Sleeper user ID or draft slot to calculate your roster fulfillment.
        </p>
      ) : null}

      <ul className="mt-3 space-y-1 text-sm">
        {roster.rosterSlots.map((slot) => (
          <li key={slot.position} className="flex items-center justify-between gap-3">
            <PositionHover label={slot.position} players={slot.players} />
            <span className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
              <span>
                {slot.filled} / {slot.required}
              </span>
              <span
                className={
                  slot.status === "fulfilled"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : slot.status === "at_risk"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }
              >
                {slot.required <= 0 ? "—" : STATUS_LABEL[slot.status]}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
        Roster: {roster.filledRosterSpots} / {roster.totalRosterSpots}
        <span className="ml-3 text-zinc-500">
          {roster.requirements.rounds > 0 ? "from draft rounds" : "from slot settings"}
          {roster.starterSpots > 0 ? ` · ${roster.starterSpots} starters` : ""}
          {roster.requirements.bench > 0 ? ` · ${roster.requirements.bench} bench` : ""}
        </span>
      </p>
      <p className="text-sm text-zinc-500">Spots left: {roster.remainingRosterSpots}</p>

      <div className="mt-3 text-sm">
        <p className="font-medium">Your positions</p>
        {roster.positionCounts.length === 0 ? (
          <p className="mt-1 text-zinc-500">None yet</p>
        ) : (
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
            {roster.positionCounts.map((item) => (
              <li key={item.position} className="flex items-baseline justify-between gap-1">
                <PositionHover label={item.position} players={item.players} />
                <span className="font-medium tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 text-sm">
        <p className="font-medium">Draft strategy</p>
        <p>
          Next priority:{" "}
          {roster.nextPriority.length > 0 ? roster.nextPriority.join(" / ") : "None"}
        </p>
        <p>Flexible: {roster.flexible.length > 0 ? roster.flexible.join(" / ") : "None"}</p>
      </div>
    </section>
  );
}
