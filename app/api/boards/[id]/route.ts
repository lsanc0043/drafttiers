import { NextResponse } from "next/server";
import { deleteBoard, getBoard, updateBoard } from "@/lib/boards";
import { updateBoardSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type BoardRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: BoardRouteContext) {
  const { id } = await params;
  const board = await getBoard(id);

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ board });
}

export async function PATCH(request: Request, { params }: BoardRouteContext) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateBoardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const board = await updateBoard(id, parsed.data);
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ board });
}

export async function DELETE(_request: Request, { params }: BoardRouteContext) {
  const { id } = await params;
  const deleted = await deleteBoard(id);
  if (!deleted) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
