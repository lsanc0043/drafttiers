import { NextResponse } from "next/server";
import { clearBoardFavorites } from "@/lib/boards";

export const dynamic = "force-dynamic";

type FavoritesRouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, { params }: FavoritesRouteContext) {
  const { id } = await params;
  const cleared = await clearBoardFavorites(id);
  if (!cleared) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
