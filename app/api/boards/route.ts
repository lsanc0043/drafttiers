import { NextResponse } from "next/server";
import { createBoard, listBoards } from "@/lib/boards";
import { createBoardSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const boards = await listBoards();
  return NextResponse.json({ boards });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createBoardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const board = await createBoard(parsed.data);
  return NextResponse.json({ board }, { status: 201 });
}
