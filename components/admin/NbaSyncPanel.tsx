"use client";

import { useEffect, useState } from "react";

type SyncStatus = {
  status: "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  fetchedCount: number | null;
  insertedCount: number | null;
  updatedCount: number | null;
  failedCount: number | null;
  lastError: string | null;
  playerCount: number;
};

type SyncResult = {
  success: true;
  fetched: number;
  inserted: number;
  updated: number;
  failed: number;
  completedAt: string;
};

export function NbaSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/admin/nba/sync", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load NBA sync status");
        }
        setStatus((await response.json()) as SyncStatus);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load sync status");
      });

    return () => controller.abort();
  }, []);

  async function onSync() {
    if (syncing) {
      return;
    }

    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/nba/sync", { method: "POST" });
      const payload = (await response.json()) as SyncResult | { success?: false; error?: string };

      if (!response.ok || !("success" in payload) || payload.success !== true) {
        throw new Error("error" in payload && payload.error ? payload.error : "NBA sync failed");
      }

      setResult(payload);
      const statusResponse = await fetch("/api/admin/nba/sync", { cache: "no-store" });
      if (statusResponse.ok) {
        setStatus((await statusResponse.json()) as SyncStatus);
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "NBA sync failed");
      const statusResponse = await fetch("/api/admin/nba/sync", { cache: "no-store" });
      if (statusResponse.ok) {
        setStatus((await statusResponse.json()) as SyncStatus);
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-medium">NBA player catalog</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Fetch the full NBA player dataset with nba_api and upsert it into PostgreSQL.
          This never runs automatically.
        </p>
      </div>

      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {syncing ? "Syncing..." : "Sync NBA Players"}
      </button>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {result ? (
        <dl className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <div>
            <dt className="text-zinc-500">Fetched</dt>
            <dd className="font-medium">{result.fetched}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Inserted</dt>
            <dd className="font-medium">{result.inserted}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Updated</dt>
            <dd className="font-medium">{result.updated}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Failed</dt>
            <dd className="font-medium">{result.failed}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-zinc-500">Completed</dt>
            <dd className="font-medium">{new Date(result.completedAt).toLocaleString()}</dd>
          </div>
        </dl>
      ) : null}

      <dl className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <div>Status: {status?.status ?? "Loading..."}</div>
        <div>Players in database: {status?.playerCount ?? "—"}</div>
        <div>
          Last successful sync:{" "}
          {status?.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString() : "Never"}
        </div>
        {status?.lastError ? <div>Last error: {status.lastError}</div> : null}
      </dl>
    </section>
  );
}
