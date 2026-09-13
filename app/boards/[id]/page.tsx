type BoardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Board</h1>
      <p className="mt-2 text-zinc-500">Board {id} editor will live here.</p>
    </main>
  );
}
