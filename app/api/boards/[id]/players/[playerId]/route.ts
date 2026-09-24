import { NextResponse } from "next/server";
import { unassignPlayerFromBoard, updateBoardPlayerNotes } from "@/lib/boards";
import { updateBoardPlayerNotesSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type BoardPlayerRouteContext = {
  params: Promise<{ id: string; playerId: string }>;
};

export async function PATCH(request: Request, { params }: BoardPlayerRouteContext) {
  const { id, playerId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateBoardPlayerNotesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const player = await updateBoardPlayerNotes(id, playerId, parsed.data);
  if (!player) {
    return NextResponse.json({ error: "Player is not on this board" }, { status: 404 });
  }

  return NextResponse.json({ player });
}

export async function DELETE(_request: Request, { params }: BoardPlayerRouteContext) {
  const { id, playerId } = await params;
  const deleted = await unassignPlayerFromBoard(id, playerId);
  if (!deleted) {
    return NextResponse.json({ error: "Player is not on this board" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
