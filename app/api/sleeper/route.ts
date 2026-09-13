import { NextResponse } from "next/server";
import { sleeperDraftLinkSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json({ linkedDrafts: [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = sleeperDraftLinkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    { message: "Sleeper draft linking is not implemented yet", input: parsed.data },
    { status: 501 },
  );
}
