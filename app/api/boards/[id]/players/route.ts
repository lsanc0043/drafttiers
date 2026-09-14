import { NextResponse } from "next/server";
import { assignPlayerToBucket, bulkUpdateBoardPlayers, clearBoardPlayers } from "@/lib/boards";
import { assignBoardPlayerSchema, bulkBoardPlayersSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type BoardPlayersRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: BoardPlayersRouteContext) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = assignBoardPlayerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await assignPlayerToBucket(id, parsed.data);
  if (!result.ok) {
    const status = result.reason === "player" ? 400 : 404;
    return NextResponse.json({ error: "Could not assign player" }, { status });
  }

  return NextResponse.json({ player: result.player, bucketId: result.bucketId });
}

export async function PATCH(request: Request, { params }: BoardPlayersRouteContext) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bulkBoardPlayersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await bulkUpdateBoardPlayers(id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Could not update players" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: BoardPlayersRouteContext) {
  const { id } = await params;
  const cleared = await clearBoardPlayers(id);
  if (!cleared) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
