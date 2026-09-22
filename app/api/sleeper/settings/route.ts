import { NextResponse } from "next/server";
import { importSleeperDraftSettings } from "@/lib/sleeper/settings";
import { sleeperDraftLookupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function lookupId(request: Request, body: unknown) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sleeperDraftId") ?? url.searchParams.get("draftId");
  if (fromQuery) {
    return sleeperDraftLookupSchema.safeParse({ sleeperDraftId: fromQuery });
  }
  return sleeperDraftLookupSchema.safeParse(body);
}

async function handleLookup(request: Request, body: unknown) {
  const parsed = lookupId(request, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const imported = await importSleeperDraftSettings(parsed.data.sleeperDraftId);
    return NextResponse.json(imported);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Sleeper draft";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  return handleLookup(request, null);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return handleLookup(request, body);
}
