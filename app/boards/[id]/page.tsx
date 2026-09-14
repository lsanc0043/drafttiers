import { BoardEditor } from "@/components/board/BoardEditor";

type BoardPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;

  return (
    <main className="flex min-h-0 flex-1 flex-col p-6">
      <BoardEditor boardId={id} />
    </main>
  );
}
