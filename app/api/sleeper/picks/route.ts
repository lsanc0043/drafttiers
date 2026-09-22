import { NextResponse } from "next/server";
import { sleeperGetJson } from "@/lib/sleeper/client";
import { parseSleeperId } from "@/lib/sleeper/ids";
import { withNbaFantasyPositions } from "@/lib/sleeper/nba-fantasy-positions";
import { EXAMPLE_SLEEPER_DRAFT_ID, type SleeperDraftPick } from "@/lib/sleeper/picks";
import { sleeperDraftLookupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("sleeperDraftId") ?? url.searchParams.get("draftId") ?? "";
  const parsed = sleeperDraftLookupSchema.safeParse({ sleeperDraftId: raw });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const draftId = parseSleeperId(parsed.data.sleeperDraftId);
  if (!draftId) {
    return NextResponse.json({ error: "Enter a Sleeper draft ID" }, { status: 400 });
  }

  try {
    const picks = await sleeperGetJson<SleeperDraftPick[]>(`/draft/${draftId}/picks`);
    if (!Array.isArray(picks)) {
      return NextResponse.json({ error: "Sleeper draft not found" }, { status: 404 });
    }
    return NextResponse.json({
      sleeperDraftId: draftId,
      example: draftId === EXAMPLE_SLEEPER_DRAFT_ID,
      picks: await withNbaFantasyPositions(picks),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Sleeper picks";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
