export type SleeperNewsItem = {
  title: string;
  description: string | null;
  analysis: string | null;
  source: string | null;
  publishedAt: string | null;
  playerId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function publishedAt(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const millis = value < 1e12 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function newsItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  const record = asRecord(raw);
  if (!record) {
    return [];
  }
  for (const key of ["value", "news", "articles", "data"]) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  return [];
}

export function parseSleeperNews(raw: unknown): SleeperNewsItem[] {
  return newsItems(raw).flatMap((item) => {
    const row = asRecord(item);
    if (!row) {
      return [];
    }
    const metadata = asRecord(row.metadata) ?? {};
    const title =
      asString(metadata.title) ??
      asString(row.title) ??
      asString(metadata.headline);
    if (!title) {
      return [];
    }
    return [
      {
        title,
        description: asString(metadata.description) ?? asString(row.description),
        analysis: asString(metadata.analysis) ?? asString(row.analysis),
        source: asString(row.source) ?? asString(metadata.source),
        publishedAt: publishedAt(row.published ?? row.published_at ?? metadata.published),
        playerId: asString(row.player_id) ?? asString(row.playerId),
      },
    ];
  });
}

export async function fetchSleeperPlayerNews(sleeperPlayerId: string): Promise<SleeperNewsItem[]> {
  const response = await fetch(
    `https://api.sleeper.com/players/nba/${encodeURIComponent(sleeperPlayerId)}/news`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Sleeper news failed (${response.status})`);
  }
  return parseSleeperNews(await response.json());
}
