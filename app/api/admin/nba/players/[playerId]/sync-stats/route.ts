import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { StatsSyncInProgressError, syncNbaStats } from "@/lib/nba/stats-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ playerId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { playerId } = await context.params;
  const numericId = Number(playerId);

  const player = await prisma.player.findFirst({
    where: Number.isInteger(numericId) && numericId > 0
      ? { OR: [{ id: playerId }, { nbaPersonId: numericId }] }
      : { id: playerId },
    select: { nbaPersonId: true },
  });

  if (!player) {
    return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
  }

  try {
    const result = await syncNbaStats({ playerId: player.nbaPersonId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatsSyncInProgressError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "NBA player stats sync failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
