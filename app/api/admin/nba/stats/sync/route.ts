import { NextResponse } from "next/server";
import { getNbaStatsSyncStatus, StatsSyncInProgressError, syncNbaStats } from "@/lib/nba/stats-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET() {
  const status = await getNbaStatsSyncStatus();
  return NextResponse.json(status);
}

export async function POST() {
  try {
    const result = await syncNbaStats();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatsSyncInProgressError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "NBA stats sync failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
