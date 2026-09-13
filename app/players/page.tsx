import { PlayerDirectory } from "@/components/players/PlayerDirectory";

export default function PlayersPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Players</h1>
      <p className="mt-2 mb-6 text-zinc-500">
        Data comes from PostgreSQL after a manual NBA sync.
      </p>
      <PlayerDirectory />
    </main>
  );
}
