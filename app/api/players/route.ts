import { NextResponse } from "next/server";
import { listPlayers } from "@/lib/nba/players";
import { playerListQuerySchema } from "@/lib/nba/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = playerListQuerySchema.safeParse({
    query: searchParams.get("query") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    active: searchParams.get("active") ?? undefined,
    team: searchParams.get("team") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    sortDir: searchParams.get("sortDir") ?? undefined,
    scoring: searchParams.get("scoring") ?? undefined,
    rookies: searchParams.get("rookies") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await listPlayers(parsed.data);
  return NextResponse.json(result);
}
