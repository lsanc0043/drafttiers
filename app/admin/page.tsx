import { NbaSyncPanel } from "@/components/admin/NbaSyncPanel";

export default function AdminPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 mb-8 text-zinc-500">Data management for DraftTier.</p>
      <NbaSyncPanel />
    </main>
  );
}
