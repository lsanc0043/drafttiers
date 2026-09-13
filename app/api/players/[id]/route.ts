import { NextResponse } from "next/server";
import { getPlayerDetail } from "@/lib/nba/player-detail";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const detail = await getPlayerDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load player stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
