import { NextResponse } from "next/server";
import { listPlayerNamePositions } from "@/lib/nba/players";

export const dynamic = "force-dynamic";

export async function GET() {
  const players = await listPlayerNamePositions();
  return NextResponse.json({
    players: players.map((player) => ({
      playerId: player.id,
      fullName: player.fullName,
      position: player.position,
    })),
  });
}
