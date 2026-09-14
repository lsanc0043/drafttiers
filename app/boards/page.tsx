import { BoardList } from "@/components/board/BoardList";

export default function BoardsPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Boards</h1>
      <div className="mt-6">
        <BoardList />
      </div>
    </main>
  );
}
