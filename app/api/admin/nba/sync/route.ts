import { NextResponse } from "next/server";
import { getNbaSyncStatus, syncNbaPlayers, SyncInProgressError } from "@/lib/nba/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const status = await getNbaSyncStatus();
  return NextResponse.json(status);
}

export async function POST() {
  try {
    const result = await syncNbaPlayers();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyncInProgressError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "NBA sync failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
