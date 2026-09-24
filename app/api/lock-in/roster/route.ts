import { NextResponse } from "next/server";
import { loadLockInRoster } from "@/lib/statdunk/load";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const team = url.searchParams.get("team")?.trim() ?? "";
  const name = url.searchParams.get("name")?.trim() ?? "";
  const nbaPersonIdValue = Number(url.searchParams.get("nbaPersonId"));
  const nbaPersonId = Number.isInteger(nbaPersonIdValue) && nbaPersonIdValue > 0 ? nbaPersonIdValue : null;

  if (!team && !nbaPersonId && !name) {
    return NextResponse.json({ error: "Player or team is required" }, { status: 400 });
  }

  try {
    const roster = await loadLockInRoster({
      team,
      nbaPersonId,
      fullName: name,
    });
    if (!roster) {
      return NextResponse.json({ error: "No 2026-27 Lock-In roster found" }, { status: 404 });
    }
    return NextResponse.json(roster);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Lock-In roster";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
