"use client";

import { RosterNeedsPanel } from "@/components/sleeper/RosterNeedsPanel";
import { UserDraftedPicksList } from "@/components/sleeper/UserDraftedPicksList";
import { useSleeperLivePicks } from "@/hooks/useSleeperLivePicks";

type SleeperLiveTrackingBarProps = ReturnType<typeof useSleeperLivePicks>;

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

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-end gap-2">
        {mock ? (
          <label className="min-w-[16rem] flex-1 text-sm">
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
          <label className="min-w-[12rem] flex-1 text-sm">
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
        <label className="w-28 text-sm">
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
        <button
          type="button"
          disabled={tracking || !canStartLive}
          onClick={() => void startLive()}
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
          onClick={() => void startExample()}
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
      <p className="text-sm text-zinc-500">
        {mode === "live" && mock
          ? `Live mock draft · ${fetchSource ?? "polling"} · ${draftStatus ?? "polling"} · ${pickCount} picks`
          : mode === "live"
            ? `Live polling every second · ${pickCount} picks`
            : mode === "example"
              ? `Example replay · ${pickCount} picks${
                  lastDelayMs != null ? ` · next pick in ${(lastDelayMs / 1000).toFixed(1)}s` : ""
                }`
              : mock
                ? "Paste the full Sleeper NBA mock draft URL and your draft slot, then start tracking. Other teams gray out; your picks stay green."
                : canStartLive
                  ? "Imported draft ID is ready. Start live tracking, switch to a mock draft, or run the example replay."
                  : "Enter your draft slot, then paste a Sleeper draft ID, switch to a live mock draft URL, or run the example replay."}
      </p>
      {lastPickLabel ? (
        <p className={`text-sm font-medium ${lastPickLabel.startsWith("NEW PICK") ? "text-amber-700 dark:text-amber-400" : ""}`}>
          {lastPickLabel.startsWith("NEW PICK") ? lastPickLabel : `Last pick: ${lastPickLabel}`}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {showRoster ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
          <RosterNeedsPanel
            roster={roster}
            hasUser={hasRosterUser}
            preDraft={draftStatus?.toLowerCase() === "pre_draft" || pickCount === 0}
          />
          <UserDraftedPicksList picks={myDraftPicks} />
        </div>
      ) : null}
    </div>
  );
}
