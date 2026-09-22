"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RosterNeedsPanel } from "@/components/sleeper/RosterNeedsPanel";
import { parseSleeperNbaDraftUrl } from "@/lib/sleeper/ids";
import { matchSleeperPickToPlayer, parseDraftPosition } from "@/lib/sleeper/picks";
import {
  calculateRosterNeeds,
  getUserPicks,
  parseRosterRequirements,
  resolveSleeperUserId,
  toDraftedRosterPlayers,
} from "@/lib/sleeper/roster";
import { fetchMockDraftSnapshot } from "@/lib/sleeper/tracker/client";
import { diffDraftPicks } from "@/lib/sleeper/tracker/diff";
import { playerLabel, playerMeta } from "@/lib/sleeper/tracker/parser";
import { createDraftPoller } from "@/lib/sleeper/tracker/polling";
import type { DraftDiff, DraftPick, DraftSnapshot } from "@/lib/sleeper/tracker/types";

type TrackedPick = DraftPick & { detectedAt: string };

function logTracker(message: string) {
  console.log(`[Tracker] ${message}`);
}

function formatTime(value: Date) {
  return value.toLocaleTimeString();
}

export function MockDraftTracker() {
  const [url, setUrl] = useState("");
  const [intervalMs, setIntervalMs] = useState(1000);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connected" | "error" | "complete">("idle");
  const [draftStatus, setDraftStatus] = useState<string>("—");
  const [source, setSource] = useState<"graphql" | "rest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPoll, setLastPoll] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [picks, setPicks] = useState<TrackedPick[]>([]);
  const [latestEvent, setLatestEvent] = useState<{ pick: TrackedPick; kind: string } | null>(null);
  const [snapshot, setSnapshot] = useState<DraftSnapshot | null>(null);
  const [userIdInput, setUserIdInput] = useState("");
  const [draftSlotInput, setDraftSlotInput] = useState("");
  const [directoryPlayers, setDirectoryPlayers] = useState<
    Array<{ playerId: string; fullName: string; position: string | null }>
  >([]);
  const snapshotRef = useRef<DraftSnapshot | null>(null);
  const stoppedRef = useRef(true);
  const intervalRef = useRef(intervalMs);
  const pollCountRef = useRef(0);
  const pollerRef = useRef(createDraftPoller({
    fetchSnapshot: async () => undefined,
    intervalMs: () => 1000,
    isStopped: () => true,
  }));

  useEffect(() => {
    intervalRef.current = intervalMs;
  }, [intervalMs]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/players/positions", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          players?: Array<{ playerId: string; fullName: string; position: string | null }>;
        };
        if (!cancelled && Array.isArray(payload.players)) {
          setDirectoryPlayers(payload.players);
        }
      })
      .catch(() => {
        // Roster needs can still use Sleeper pick metadata.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      pollerRef.current.stop();
    };
  }, []);

  async function pullSnapshot(id: string) {
    pollCountRef.current += 1;
    logTracker(`Poll #${pollCountRef.current}`);
    const payload = await fetchMockDraftSnapshot(id);
    const previous = snapshotRef.current;
    const diff: DraftDiff = diffDraftPicks(previous?.picks ?? [], payload.snapshot.picks);
    const detectedAt = formatTime(new Date());
    snapshotRef.current = payload.snapshot;
    setSnapshot(payload.snapshot);
    setSource(payload.source ?? null);
    setDraftStatus(payload.snapshot.status);
    setLastPoll(detectedAt);
    setPollCount(pollCountRef.current);
    setError(null);
    setStatus(payload.snapshot.status.toLowerCase() === "complete" ? "complete" : "connected");
    logTracker(`Picks: ${payload.snapshot.picks.length}`);

    setPicks((current) => {
      const detectedByNo = new Map(current.map((pick) => [pick.pickNo, pick.detectedAt]));
      return payload.snapshot!.picks
        .map((pick) => ({
          ...pick,
          detectedAt: detectedByNo.get(pick.pickNo) ?? detectedAt,
        }))
        .sort((left, right) => right.pickNo - left.pickNo);
    });

    if (diff.added.length > 0) {
      const newest = diff.added[diff.added.length - 1];
      logTracker(`New pick detected: #${newest.pickNo}`);
      setLatestEvent({ pick: { ...newest, detectedAt }, kind: "added" });
    } else if (diff.changed.length > 0) {
      const newest = diff.changed[diff.changed.length - 1].current;
      logTracker(`Changed pick detected: #${newest.pickNo}`);
      setLatestEvent({ pick: { ...newest, detectedAt }, kind: "changed" });
    } else if (diff.removed.length > 0) {
      const newest = diff.removed[diff.removed.length - 1];
      logTracker(`Removed pick detected: #${newest.pickNo}`);
      setLatestEvent({ pick: { ...newest, detectedAt }, kind: "removed" });
    }

    if (payload.snapshot.status.toLowerCase() === "complete") {
      logTracker("Draft complete");
      stoppedRef.current = true;
      pollerRef.current.stop();
    }
  }

  function startTracking() {
    const id = parseSleeperNbaDraftUrl(url);
    if (!id) {
      setError("Paste a full Sleeper NBA mock draft URL like https://sleeper.com/draft/nba/...");
      setStatus("error");
      return;
    }

    pollerRef.current.stop();
    stoppedRef.current = false;
    snapshotRef.current = null;
    pollCountRef.current = 0;
    setDraftId(id);
    setPicks([]);
    setLatestEvent(null);
    setSnapshot(null);
    setPollCount(0);
    setError(null);
    setStatus("connected");
    logTracker("Starting");
    logTracker(`Draft ID: ${id}`);

    pollerRef.current = createDraftPoller({
      intervalMs: () => intervalRef.current,
      isStopped: () => stoppedRef.current,
      fetchSnapshot: async () => {
        try {
          await pullSnapshot(id);
        } catch (pollError) {
          const message = pollError instanceof Error ? pollError.message : "Could not load Sleeper draft";
          setError(message);
          setStatus("error");
          logTracker(`Poll failed: ${message}`);
        }
      },
    });
    pollerRef.current.start();
  }

  function stopTracking() {
    stoppedRef.current = true;
    pollerRef.current.stop();
    setStatus((current) => (current === "complete" ? current : "idle"));
    logTracker("Stopped");
  }

  const latestMeta = latestEvent ? playerMeta(latestEvent.pick) : null;
  const myUserId = resolveSleeperUserId({
    typedUserId: userIdInput,
    draftSlot: parseDraftPosition(draftSlotInput, snapshot?.teams),
    picks: snapshot?.picks,
  });
  const roster = useMemo(() => {
    const requirements = snapshot?.rosterRequirements ?? parseRosterRequirements();
    const userPicks = getUserPicks(snapshot?.picks ?? [], myUserId);
    return calculateRosterNeeds(
      requirements,
      toDraftedRosterPlayers(
        userPicks.map((pick) => {
          const mapped = matchSleeperPickToPlayer(
            {
              pick_no: pick.pickNo,
              player_id: pick.playerId,
              metadata: {
                first_name: playerMeta(pick).firstName,
                last_name: playerMeta(pick).lastName,
              },
            },
            directoryPlayers,
          );
          const meta = playerMeta(pick);
          return {
            pickNo: pick.pickNo,
            playerId: pick.playerId,
            label: playerLabel(pick),
            positions:
              meta.fantasyPositions.length > 0
                ? meta.fantasyPositions
                : meta.position || mapped?.position,
          };
        }),
      ),
    );
  }, [directoryPlayers, myUserId, snapshot]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sleeper Mock Draft Tracker</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Temporary polling prototype. Paste a Sleeper NBA mock draft URL. This page does not change
          board assignments.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Sleeper Draft URL</span>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://sleeper.com/draft/nba/..."
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>

      <label className="block max-w-xs text-sm">
        <span className="font-medium">Polling interval</span>
        <input
          type="number"
          min={250}
          step={250}
          value={intervalMs}
          onChange={(event) => setIntervalMs(Number(event.target.value) || 1000)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        <span className="mt-1 block text-xs text-zinc-500">milliseconds</span>
      </label>

      <label className="block max-w-xs text-sm">
        <span className="font-medium">Your Sleeper user ID</span>
        <input
          value={userIdInput}
          onChange={(event) => setUserIdInput(event.target.value)}
          placeholder="picked_by user id"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>

      <label className="block max-w-xs text-sm">
        <span className="font-medium">Your draft slot</span>
        <input
          type="number"
          min={1}
          max={30}
          value={draftSlotInput}
          onChange={(event) => setDraftSlotInput(event.target.value)}
          placeholder="Optional if you paste a user ID"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>

      {snapshot?.users.length ? (
        <label className="block max-w-xs text-sm">
          <span className="font-medium">Draft members</span>
          <select
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-700"
          >
            <option value="">Select your Sleeper user</option>
            {snapshot.users.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startTracking}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Start Tracking
        </button>
        <button
          type="button"
          onClick={stopTracking}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Stop
        </button>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd className="font-medium capitalize">{status}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Draft ID</dt>
          <dd className="font-medium">{draftId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Draft status</dt>
          <dd className="font-medium">{draftStatus}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Fetch source</dt>
          <dd className="font-medium">{source ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Polling interval</dt>
          <dd className="font-medium">{intervalMs} ms</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Last poll</dt>
          <dd className="font-medium">{lastPoll ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Total picks</dt>
          <dd className="font-medium">{picks.length}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Polls</dt>
          <dd className="font-medium">{pollCount}</dd>
        </div>
      </dl>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {snapshot ? (
        <RosterNeedsPanel
          roster={roster}
          hasUser={Boolean(myUserId)}
          preDraft={snapshot.status.toLowerCase() === "pre_draft" || snapshot.picks.length === 0}
        />
      ) : null}

      {latestEvent ? (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm font-semibold tracking-wide">
            {latestEvent.kind === "added"
              ? "NEW PICK DETECTED"
              : latestEvent.kind === "changed"
                ? "PICK CHANGED"
                : "PICK REMOVED"}
          </p>
          <p className="mt-2 text-lg font-medium">Pick #{latestEvent.pick.pickNo}</p>
          <p className="text-sm">
            Player: {playerLabel(latestEvent.pick)} ({latestEvent.pick.playerId || "—"})
          </p>
          <p className="text-sm">Picked by: {latestEvent.pick.pickedBy || "—"}</p>
          {latestMeta ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {latestMeta.position || "—"} · {latestMeta.team || "—"}
            </p>
          ) : null}
          <p className="mt-1 text-sm">Detected: {latestEvent.pick.detectedAt}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">Pick</th>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">Player ID</th>
              <th className="px-3 py-2 font-medium">Pos</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Picked By</th>
              <th className="px-3 py-2 font-medium">Detected</th>
            </tr>
          </thead>
          <tbody>
            {picks.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-zinc-500" colSpan={7}>
                  No picks yet.
                </td>
              </tr>
            ) : (
              picks.map((pick) => {
                const meta = playerMeta(pick);
                return (
                  <tr key={pick.pickNo} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="px-3 py-2">{pick.pickNo}</td>
                    <td className="px-3 py-2">{playerLabel(pick)}</td>
                    <td className="px-3 py-2">{pick.playerId || "—"}</td>
                    <td className="px-3 py-2">{meta.position || "—"}</td>
                    <td className="px-3 py-2">{meta.team || "—"}</td>
                    <td className="px-3 py-2">{pick.pickedBy || "—"}</td>
                    <td className="px-3 py-2">{pick.detectedAt}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
