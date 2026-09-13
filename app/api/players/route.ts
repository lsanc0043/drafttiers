import { NextResponse } from "next/server";
import { playerSearchSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = playerSearchSchema.safeParse({
    query: searchParams.get("query") ?? "",
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    players: [],
    query: parsed.data.query,
  });
}
