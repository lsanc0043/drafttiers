import { NextResponse } from "next/server";
import { loadLockInStartingFive } from "@/lib/statdunk/load";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const team = new URL(request.url).searchParams.get("team")?.trim() ?? "";
  if (!team) {
    return NextResponse.json({ error: "Team is required" }, { status: 400 });
  }

  try {
    const starters = await loadLockInStartingFive(team);
    return NextResponse.json({ team: team.toUpperCase(), starters });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load predicted starting five";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
