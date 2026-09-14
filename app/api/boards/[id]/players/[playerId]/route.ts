import { NextResponse } from "next/server";
import { unassignPlayerFromBoard } from "@/lib/boards";

export const dynamic = "force-dynamic";

type BoardPlayerRouteContext = {
  params: Promise<{ id: string; playerId: string }>;
};

export async function DELETE(_request: Request, { params }: BoardPlayerRouteContext) {
  const { id, playerId } = await params;
  const deleted = await unassignPlayerFromBoard(id, playerId);
  if (!deleted) {
    return NextResponse.json({ error: "Player is not on this board" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
