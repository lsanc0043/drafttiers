import type { NbaPlayerInput } from "@/lib/nba/schema";

export function dedupePlayers(players: NbaPlayerInput[]): NbaPlayerInput[] {
  const byId = new Map<number, NbaPlayerInput>();
  for (const player of players) {
    byId.set(player.nbaPersonId, player);
  }
  return [...byId.values()];
}

export function summarizeUpsert(existingIds: Set<number>, incomingIds: number[]) {
  let inserted = 0;
  let updated = 0;

  for (const id of incomingIds) {
    if (existingIds.has(id)) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  return { inserted, updated };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
