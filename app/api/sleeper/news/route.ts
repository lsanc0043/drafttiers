import { NextResponse } from "next/server";
import { resolveSleeperNbaPlayerId } from "@/lib/sleeper/nba-ids";
import { fetchSleeperPlayerNews } from "@/lib/sleeper/news";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sleeperPlayerId = url.searchParams.get("sleeperPlayerId")?.trim() ?? "";
  const name = url.searchParams.get("name")?.trim() ?? "";
  const team = url.searchParams.get("team")?.trim() || null;

  let playerId = /^\d{3,}$/.test(sleeperPlayerId) ? sleeperPlayerId : "";
  if (!playerId && name) {
    playerId = (await resolveSleeperNbaPlayerId(name, team)) ?? "";
  }
  if (!playerId) {
    return NextResponse.json({ error: "Could not resolve Sleeper player" }, { status: 404 });
  }

  try {
    const news = await fetchSleeperPlayerNews(playerId);
    return NextResponse.json({ sleeperPlayerId: playerId, news });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Sleeper news";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
