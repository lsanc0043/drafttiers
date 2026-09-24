import { LockInExplorer } from "@/components/statdunk/LockInExplorer";
import { loadLockInBundle } from "@/lib/statdunk/load";

export default async function LockInPage() {
  const bundle = await loadLockInBundle();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Lock In</h1>
      <p className="mt-2 mb-6 text-zinc-500">
        StatDunk NBA Lock-In projections scraped from the public JSON APIs.
      </p>
      {bundle ? (
        <LockInExplorer
          dataset={bundle.dataset}
          photoIds={bundle.photoIds}
          directoryPlayers={bundle.directoryPlayers}
          injuries={bundle.injuries}
        />
      ) : (
        <p className="text-sm text-zinc-500">
          No Lock-In dataset found. Run `pnpm scrape:statdunk` to fetch StatDunk JSON and populate this table.
        </p>
      )}
    </main>
  );
}
