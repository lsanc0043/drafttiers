import { NextResponse } from "next/server";
import { fetchDraftSnapshot } from "@/lib/sleeper/tracker/graphql";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const draftId = new URL(request.url).searchParams.get("draftId")?.trim() ?? "";
  if (!/^\d{6,}$/.test(draftId)) {
    return NextResponse.json({ error: "Enter a valid Sleeper NBA draft ID" }, { status: 400 });
  }

  try {
    const result = await fetchDraftSnapshot(draftId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Sleeper draft";
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
