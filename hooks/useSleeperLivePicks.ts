"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EXAMPLE_SLEEPER_DRAFT_ID,
  latestSleeperPick,
  matchPickedPlayerIds,
  matchSleeperPickToPlayer,
  matchUserDraftedPlayerIds,
  parseDraftPosition,
  pickBelongsToDraftPosition,
  sleeperPickName,
  type SleeperDraftPick,
} from "@/lib/sleeper/picks";
import {
  calculateRosterNeeds,
  getUserPicks,
  parseRosterRequirements,
  resolveSleeperUserId,
  sleeperPositionLabel,
  toDraftedRosterPlayers,
} from "@/lib/sleeper/roster";
import { mapSleeperDraftType } from "@/lib/sleeper/settings";
import { fetchMockDraftSnapshot } from "@/lib/sleeper/tracker/client";
import { diffDraftPicks } from "@/lib/sleeper/tracker/diff";
import { playerLabel, toSleeperDraftPicks } from "@/lib/sleeper/tracker/parser";
import { createDraftPoller } from "@/lib/sleeper/tracker/polling";
import type { DraftSnapshot } from "@/lib/sleeper/tracker/types";
import { parseSleeperId, parseSleeperNbaDraftUrl } from "@/lib/sleeper/ids";

type TrackingMode = "idle" | "live" | "example";
type TrackingSource = "imported" | "mock";

type UseSleeperLivePicksArgs = {
  boardId: string;
  players: Array<{ playerId: string; fullName: string; position?: string | null }>;
  initialDraftId?: string | null;
  initialDraftPosition?: number | null;
  initialTeamCount?: number | null;
  initialDraftType?: string | null;
  onPersistDraftId?: (draftId: string) => void;
};

async function fetchPicks(draftId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/sleeper/picks?sleeperDraftId=${encodeURIComponent(draftId)}`,
    { cache: "no-store", signal },
  );
  const payload = (await response.json()) as { picks?: SleeperDraftPick[]; error?: unknown };
  if (!response.ok || !Array.isArray(payload.picks)) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Could not load Sleeper picks");
  }
  return payload.picks;
}

function storageKey(boardHint: string, source: TrackingSource = "imported") {
  return source === "mock"
    ? `drafttiers.sleeperMockDraftUrl.${boardHint}`
    : `drafttiers.sleeperDraftId.${boardHint}`;
}

export function useSleeperLivePicks({
  boardId,
  players,
  initialDraftId,
  initialDraftPosition,
  initialTeamCount,
  initialDraftType,
  onPersistDraftId,
}: UseSleeperLivePicksArgs) {
  const [mode, setMode] = useState<TrackingMode>("idle");
  const [source, setSource] = useState<TrackingSource>("imported");
  const [draftIdInput, setDraftIdInput] = useState(initialDraftId ?? "");
  const [mockUrlInput, setMockUrlInput] = useState("");
  const [draftPositionInput, setDraftPositionInput] = useState(
    initialDraftPosition != null ? String(initialDraftPosition) : "",
  );
  const [picks, setPicks] = useState<SleeperDraftPick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastDelayMs, setLastDelayMs] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [lastAddedLabel, setLastAddedLabel] = useState<string | null>(null);
  const [liveTeamCount, setLiveTeamCount] = useState<number | null>(null);
  const [liveDraftType, setLiveDraftType] = useState<string | null>(null);
  const [fetchSource, setFetchSource] = useState<"graphql" | "rest" | null>(null);
  const [rosterSnapshot, setRosterSnapshot] = useState<DraftSnapshot | null>(null);
  const [directoryPlayers, setDirectoryPlayers] = useState<
    Array<{ playerId: string; fullName: string; position: string | null }>
  >([]);
  const exampleQueue = useRef<SleeperDraftPick[]>([]);
  const exampleIndex = useRef(0);
  const mockStoppedRef = useRef(true);
  const mockSnapshotRef = useRef<DraftSnapshot | null>(null);
  const mockPollerRef = useRef(
    createDraftPoller({
      fetchSnapshot: async () => undefined,
      intervalMs: () => 1000,
      isStopped: () => true,
    }),
  );

  useEffect(() => {
    if (source !== "imported") {
      return;
    }
    if (initialDraftId) {
      setDraftIdInput(initialDraftId);
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey(boardId));
      if (stored) {
        setDraftIdInput(stored);
      }
    } catch {
      // ignore storage failures
    }
  }, [boardId, initialDraftId, source]);

  useEffect(() => {
    if (source !== "mock") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey(boardId, "mock"));
      if (stored) {
        setMockUrlInput(stored);
      }
    } catch {
      // ignore storage failures
    }
  }, [boardId, source]);

  useEffect(() => {
    if (initialDraftPosition == null) {
      return;
    }
    setDraftPositionInput((current) => (current.trim() ? current : String(initialDraftPosition)));
  }, [initialDraftPosition]);

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
        // Off-board picks can still use Sleeper metadata.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedId =
    source === "mock"
      ? (parseSleeperNbaDraftUrl(mockUrlInput) ?? "")
      : (parseSleeperId(draftIdInput) ?? "");
  const teamCount = liveTeamCount ?? initialTeamCount ?? null;
  const draftType = liveDraftType ?? initialDraftType ?? "SNAKE";
  const draftPosition = parseDraftPosition(draftPositionInput, teamCount);
  const canStartLive =
    draftPosition != null &&
    (source === "mock" ? Boolean(parseSleeperNbaDraftUrl(mockUrlInput)) : Boolean(parseSleeperId(draftIdInput)));
  const canStartExample = draftPosition != null;
  const pickedPlayerIds = matchPickedPlayerIds(picks, players);
  const userDraftedPlayerIds = matchUserDraftedPlayerIds(
    picks,
    players,
    draftPosition,
    teamCount,
    draftType,
  );
  const latest = latestSleeperPick(picks);
  const myUserId = resolveSleeperUserId({
    draftSlot: draftPosition,
    picks: picks.map((pick) => ({
      pickedBy: pick.picked_by ?? null,
      draftSlot: pick.draft_slot ?? null,
    })),
  });
  const myDraftPicks = useMemo(() => {
    const mine = myUserId
      ? getUserPicks(
          picks.map((pick) => ({ ...pick, pickedBy: pick.picked_by ?? null })),
          myUserId,
        )
      : draftPosition != null
        ? picks.filter((pick) => pickBelongsToDraftPosition(pick, draftPosition, teamCount, draftType))
        : [];
    return [...mine]
      .sort((left, right) => (left.pick_no ?? 0) - (right.pick_no ?? 0))
      .map((pick) => {
        const onBoardPlayer = matchSleeperPickToPlayer(pick, players);
        const mapped = onBoardPlayer ?? matchSleeperPickToPlayer(pick, directoryPlayers);
        const name = sleeperPickName(pick) || mapped?.fullName || pick.player_id || "Unknown";
        const position =
          sleeperPositionLabel(pick.metadata?.fantasy_positions) ||
          pick.metadata?.position?.trim() ||
          mapped?.position ||
          "";
        return {
          pickNo: pick.pick_no ?? 0,
          name,
          position,
          onBoard: Boolean(onBoardPlayer),
          playerId: pick.player_id,
          positions: position || null,
        };
      });
  }, [directoryPlayers, draftPosition, draftType, myUserId, picks, players, teamCount]);
  const roster = useMemo(() => {
    return calculateRosterNeeds(
      rosterSnapshot?.rosterRequirements ?? parseRosterRequirements(),
      toDraftedRosterPlayers(
        myDraftPicks.map((pick) => ({
          pickNo: pick.pickNo,
          playerId: pick.playerId,
          label: pick.name,
          positions: pick.positions,
        })),
      ),
    );
  }, [myDraftPicks, rosterSnapshot]);

  useEffect(() => {
    if (mode !== "live" || source === "mock" || !resolvedId) {
      return;
    }

    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (inFlight || cancelled) {
        return;
      }
      inFlight = true;
      try {
        const next = await fetchPicks(resolvedId);
        if (!cancelled) {
          setPicks(next);
          setError(null);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Could not poll Sleeper picks");
        }
      } finally {
        inFlight = false;
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode, source, resolvedId]);

  useEffect(() => {
    if (mode !== "example") {
      return;
    }

    let cancelled = false;
    let timeout = 0;

    function queueNext() {
      if (cancelled) {
        return;
      }
      if (exampleIndex.current >= exampleQueue.current.length) {
        return;
      }
      const delay = 5000 + Math.floor(Math.random() * 5000);
      setLastDelayMs(delay);
      timeout = window.setTimeout(() => {
        exampleIndex.current += 1;
        setPicks(exampleQueue.current.slice(0, exampleIndex.current));
        queueNext();
      }, delay);
    }

    queueNext();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [mode]);

  useEffect(() => {
    if (mode === "idle") {
      return;
    }
    const id =
      source === "mock"
        ? parseSleeperNbaDraftUrl(mockUrlInput)
        : mode === "example"
          ? EXAMPLE_SLEEPER_DRAFT_ID
          : parseSleeperId(draftIdInput);
    if (!id || source === "mock") {
      return;
    }
    let cancelled = false;
    void fetchMockDraftSnapshot(id)
      .then(({ snapshot }) => {
        if (!cancelled) {
          setRosterSnapshot(snapshot);
        }
      })
      .catch(() => {
        // Picks can still track if roster settings fail to load.
      });
    return () => {
      cancelled = true;
    };
  }, [draftIdInput, mockUrlInput, mode, source]);

  useEffect(() => {
    return () => {
      mockStoppedRef.current = true;
      mockPollerRef.current.stop();
    };
  }, []);

  function stopMockPoller() {
    mockStoppedRef.current = true;
    mockPollerRef.current.stop();
  }

  function persistImported(id: string) {
    try {
      window.localStorage.setItem(storageKey(boardId), id);
    } catch {
      // ignore storage failures
    }
    onPersistDraftId?.(id);
  }

  function persistMockUrl(url: string) {
    try {
      window.localStorage.setItem(storageKey(boardId, "mock"), url.trim());
    } catch {
      // ignore storage failures
    }
  }

  function switchToMock() {
    stopMockPoller();
    setMode("idle");
    setPicks([]);
    setLastDelayMs(null);
    setDraftStatus(null);
    setLastAddedLabel(null);
    setError(null);
    setLiveTeamCount(null);
    setLiveDraftType(null);
    setFetchSource(null);
    setRosterSnapshot(null);
    const carried = parseSleeperNbaDraftUrl(mockUrlInput)
      ? mockUrlInput
      : parseSleeperNbaDraftUrl(draftIdInput)
        ? draftIdInput
        : mockUrlInput;
    if (carried !== mockUrlInput) {
      setMockUrlInput(carried);
    }
    setSource("mock");
  }

  function switchToImported() {
    stopMockPoller();
    setMode("idle");
    setPicks([]);
    setLastDelayMs(null);
    setDraftStatus(null);
    setLastAddedLabel(null);
    setError(null);
    setLiveTeamCount(null);
    setLiveDraftType(null);
    setFetchSource(null);
    setRosterSnapshot(null);
    setSource("imported");
  }

  async function startLive() {
    stopMockPoller();
    setError(null);
    setPicks([]);
    setLastDelayMs(null);
    setLastAddedLabel(null);
    setDraftStatus(null);
    setLiveTeamCount(null);
    setLiveDraftType(null);
    setFetchSource(null);
    setRosterSnapshot(null);

    if (parseDraftPosition(draftPositionInput, initialTeamCount) == null) {
      setError("Enter your draft position before starting tracking.");
      return;
    }

    if (source === "mock") {
      const id = parseSleeperNbaDraftUrl(mockUrlInput);
      if (!id) {
        setError("Paste the full Sleeper NBA mock draft URL before starting live tracking.");
        return;
      }
      persistMockUrl(mockUrlInput);
      mockSnapshotRef.current = null;
      mockStoppedRef.current = false;
      setMode("live");
      mockPollerRef.current = createDraftPoller({
        intervalMs: () => 1000,
        isStopped: () => mockStoppedRef.current,
        fetchSnapshot: async () => {
          try {
            const { snapshot, source: nextSource } = await fetchMockDraftSnapshot(id);
            const diff = diffDraftPicks(mockSnapshotRef.current?.picks ?? [], snapshot.picks);
            mockSnapshotRef.current = snapshot;
            setRosterSnapshot(snapshot);
            setPicks(toSleeperDraftPicks(snapshot.picks));
            setDraftStatus(snapshot.status);
            setFetchSource(nextSource);
            setLiveTeamCount(snapshot.teams);
            setLiveDraftType(snapshot.draftType ? mapSleeperDraftType(snapshot.draftType) : null);
            setError(null);
            if (diff.added.length > 0) {
              const newest = diff.added[diff.added.length - 1];
              setLastAddedLabel(`NEW PICK · #${newest.pickNo} ${playerLabel(newest)}`);
            }
            if (snapshot.status.toLowerCase() === "complete") {
              mockStoppedRef.current = true;
              mockPollerRef.current.stop();
            }
          } catch (pollError) {
            setError(pollError instanceof Error ? pollError.message : "Could not poll Sleeper draft");
          }
        },
      });
      mockPollerRef.current.start();
      return;
    }

    const id = parseSleeperId(draftIdInput);
    if (!id) {
      setError("Paste a Sleeper draft ID before starting live tracking.");
      return;
    }
    persistImported(id);
    setMode("live");
  }

  async function startExample() {
    stopMockPoller();
    setError(null);
    setPicks([]);
    setLastDelayMs(null);
    exampleIndex.current = 0;
    if (parseDraftPosition(draftPositionInput, initialTeamCount) == null) {
      setError("Enter your draft position before starting tracking.");
      return;
    }
    try {
      const allPicks = await fetchPicks(EXAMPLE_SLEEPER_DRAFT_ID);
      exampleQueue.current = [...allPicks].sort((left, right) => (left.pick_no ?? 0) - (right.pick_no ?? 0));
      setDraftIdInput(EXAMPLE_SLEEPER_DRAFT_ID);
      setMode("example");
    } catch (exampleError) {
      setError(exampleError instanceof Error ? exampleError.message : "Could not load example draft");
      setMode("idle");
    }
  }

  function stop() {
    stopMockPoller();
    setMode("idle");
    setLastDelayMs(null);
  }

  function resetChips() {
    stopMockPoller();
    mockSnapshotRef.current = null;
    exampleQueue.current = [];
    exampleIndex.current = 0;
    setMode("idle");
    setPicks([]);
    setLastDelayMs(null);
    setLastAddedLabel(null);
    setDraftStatus(null);
    setFetchSource(null);
    setRosterSnapshot(null);
    setError(null);
  }

  return {
    mode,
    source,
    draftIdInput,
    setDraftIdInput,
    mockUrlInput,
    setMockUrlInput,
    draftPositionInput,
    setDraftPositionInput,
    resolvedId,
    canStartLive,
    canStartExample,
    picks,
    pickedPlayerIds,
    userDraftedPlayerIds,
    pickCount: picks.length,
    lastPickLabel: lastAddedLabel
      ?? (latest
        ? `${sleeperPickName(latest) || "Unknown"} · pick ${latest.pick_no ?? "?"}`
        : null),
    lastDelayMs,
    draftStatus,
    fetchSource,
    roster,
    myDraftPicks,
    showRoster: rosterSnapshot != null || mode !== "idle",
    hasRosterUser: Boolean(myUserId || draftPosition),
    error,
    startLive,
    startExample,
    switchToMock,
    switchToImported,
    stop,
    resetChips,
    canResetChips: picks.length > 0 || mode !== "idle",
  };
}
