"use client";

import { useEffect, useRef, useState } from "react";
import { RosterNeedsPanel } from "@/components/sleeper/RosterNeedsPanel";
import { UserDraftedPicksList } from "@/components/sleeper/UserDraftedPicksList";
import { useSleeperLivePicks } from "@/hooks/useSleeperLivePicks";
import { sleeperPickName } from "@/lib/sleeper/picks";
import { sleeperPositionLabel } from "@/lib/sleeper/roster";

type SleeperLiveTrackingBarProps = ReturnType<typeof useSleeperLivePicks>;
type TrackerTab = "picks" | "roster";

export function SleeperLiveTrackingBar({
  mode,
  source,
  draftIdInput,
  setDraftIdInput,
  mockUrlInput,
  setMockUrlInput,
  draftPositionInput,
  setDraftPositionInput,
  canStartLive,
  canStartExample,
  picks,
  pickCount,
  lastPickLabel,
  lastDelayMs,
  draftStatus,
  fetchSource,
  roster,
  myDraftPicks,
  showRoster,
  hasRosterUser,
  error,
  startLive,
  startExample,
  switchToMock,
  switchToImported,
  stop,
  resetChips,
  canResetChips,
}: SleeperLiveTrackingBarProps) {
  const tracking = mode !== "idle";
  const mock = source === "mock";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TrackerTab>("picks");
  const logRef = useRef<HTMLDivElement>(null);
  const mine = new Set(myDraftPicks.map((pick) => pick.pickNo));

  useEffect(() => {
    if (!open || tab !== "picks") {
      return;
    }
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [open, tab, picks.length, lastPickLabel]);

  const statusLine =
    mode === "live" && mock
      ? `Live mock · ${fetchSource ?? "polling"} · ${draftStatus ?? "polling"}`
      : mode === "live"
        ? "Live polling"
        : mode === "example"
          ? `Example replay${lastDelayMs != null ? ` · next in ${(lastDelayMs / 1000).toFixed(1)}s` : ""}`
          : "Idle";

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close live tracking"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-label="Live draft tracking"
            className="relative z-10 flex h-[min(92dvh,44rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-background shadow-2xl sm:h-[min(85dvh,40rem)] sm:max-w-lg sm:rounded-2xl dark:border-zinc-800"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Draft tracker</p>
                <p className="truncate text-xs text-zinc-500">
                  {statusLine} · {pickCount} pick{pickCount === 1 ? "" : "s"}
                </p>
                {lastPickLabel ? (
                  <p
                    className={`mt-0.5 truncate text-xs font-medium ${
                      lastPickLabel.startsWith("NEW PICK")
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {lastPickLabel.startsWith("NEW PICK") ? lastPickLabel : `Last: ${lastPickLabel}`}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </header>

            <details className="shrink-0 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800" open={!tracking}>
              <summary className="cursor-pointer text-sm font-medium">Connection</summary>
              <div className="mt-2 space-y-2 pb-2">
                {mock ? (
                  <label className="block text-sm">
                    <span className="font-medium">Mock draft URL</span>
                    <input
                      value={mockUrlInput}
                      onChange={(event) => setMockUrlInput(event.target.value)}
                      placeholder="https://sleeper.com/draft/nba/..."
                      disabled={tracking}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-zinc-700"
                    />
                  </label>
                ) : (
                  <label className="block text-sm">
                    <span className="font-medium">Sleeper draft ID</span>
                    <input
                      value={draftIdInput}
                      onChange={(event) => setDraftIdInput(event.target.value)}
                      placeholder="Required to start live tracking"
                      disabled={tracking}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-zinc-700"
                    />
                  </label>
                )}
                <label className="block w-28 text-sm">
                  <span className="font-medium">Your draft slot</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={draftPositionInput}
                    onChange={(event) => setDraftPositionInput(event.target.value)}
                    placeholder="1–30"
                    disabled={tracking}
                    required
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 disabled:opacity-60 dark:border-zinc-700"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={tracking || !canStartLive}
                    onClick={() => {
                      setTab("picks");
                      void startLive();
                    }}
                    className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {mock ? "Start mock tracking" : "Start live tracking"}
                  </button>
                  {mock ? (
                    <button
                      type="button"
                      disabled={tracking}
                      onClick={switchToImported}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
                    >
                      Track imported draft
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={tracking}
                      onClick={switchToMock}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
                    >
                      Track live mock draft
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={tracking || !canStartExample}
                    onClick={() => {
                      setTab("picks");
                      void startExample();
                    }}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
                  >
                    Track example
                  </button>
                  {tracking ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Stop
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canResetChips}
                    onClick={resetChips}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
                  >
                    Reset chips
                  </button>
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
            </details>

              <div className="mx-4 mt-3 flex shrink-0 gap-1 rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
                <button
                  type="button"
                  aria-pressed={tab === "picks"}
                  onClick={() => setTab("picks")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                    tab === "picks"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  Picks
                </button>
                <button
                  type="button"
                  aria-pressed={tab === "roster"}
                  onClick={() => setTab("roster")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                    tab === "roster"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  Roster
                </button>
              </div>

              {tab === "picks" ? (
                <div
                  ref={logRef}
                  className="mx-4 mt-3 mb-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  {picks.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {tracking
                        ? "Waiting for picks..."
                        : "Start tracking to stream picks here like a chat log."}
                    </p>
                  ) : (
                    [...picks]
                      .sort((left, right) => (left.pick_no ?? 0) - (right.pick_no ?? 0))
                      .map((pick, index) => {
                        const pickNo = pick.pick_no ?? index + 1;
                        const yours = mine.has(pickNo);
                        const name = sleeperPickName(pick) || pick.player_id || "Unknown";
                        const position =
                          sleeperPositionLabel(pick.metadata?.fantasy_positions) ||
                          pick.metadata?.position?.trim() ||
                          "—";
                        const team = pick.metadata?.team?.trim() || "FA";
                        return (
                          <div
                            key={`${pickNo}-${pick.player_id ?? name}`}
                            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                              yours
                                ? "self-end bg-emerald-600 text-white"
                                : "self-start bg-background shadow-sm dark:bg-zinc-800"
                            }`}
                          >
                            <p className={`text-[10px] font-semibold uppercase tracking-wide ${yours ? "text-emerald-100" : "text-zinc-500"}`}>
                              Pick #{pickNo}
                              {yours ? " · you" : ""}
                            </p>
                            <p className="font-medium">{name}</p>
                            <p className={yours ? "text-emerald-100" : "text-zinc-500"}>
                              {team} · {position}
                            </p>
                          </div>
                        );
                      })
                  )}
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {showRoster ? (
                    <div className="space-y-3">
                      <RosterNeedsPanel
                        roster={roster}
                        hasUser={hasRosterUser}
                        preDraft={draftStatus?.toLowerCase() === "pre_draft" || pickCount === 0}
                      />
                      <UserDraftedPicksList picks={myDraftPicks} />
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Start tracking to see roster needs for your slot.
                    </p>
                  )}
                </div>
              )}
          </section>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-xl hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          aria-label="Open live draft tracking"
        >
          {tracking || pickCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-amber-500 px-1 text-center text-[10px] font-bold text-white">
              {pickCount}
            </span>
          ) : null}
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path
              d="M5 6h14v9H8l-3 3V6z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </>
  );
}
