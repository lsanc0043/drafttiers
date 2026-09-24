import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildLockInDataset,
  datasetToCsv,
  extractAccess,
  extractPlayers,
  extractPublication,
  nextPageUrl,
} from "../lib/statdunk/normalize";
import type { JsonRecord, StatdunkSourceMeta, StatdunkSourceName } from "../lib/statdunk/types";

const V3_URL = "https://statdunk.com/api/statdunk-nba-projections-v3-lock-in";
const TABLE_URL = "https://statdunk.com/api/statdunk-nba-projection-table?surface=locked-in&mode=averages";
const MAX_PAGES = 50;

type FetchedSource = {
  name: StatdunkSourceName;
  url: string;
  payload: unknown;
  pagesFetched: number;
};

function asRecord(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  console.log(`GET ${url}`);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "drafttiers-statdunk-scraper",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`StatDunk request failed (${response.status}) for ${url}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }
  return response.json();
}

function mergePagePayloads(pages: unknown[]): unknown {
  if (pages.length === 1) {
    return pages[0];
  }
  const first = asRecord(pages[0]) ?? { players: [] };
  const players: JsonRecord[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const player of extractPlayers(page)) {
      const key =
        (typeof player.canonicalPlayerId === "string" && player.canonicalPlayerId) ||
        (typeof player.sleeperPlayerId === "string" && player.sleeperPlayerId) ||
        JSON.stringify(player);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      players.push(player);
    }
  }
  const release = asRecord(first.release) ?? {};
  return {
    ...first,
    release: {
      ...release,
      players,
    },
  };
}

async function fetchAllPages(url: string, name: StatdunkSourceName): Promise<FetchedSource> {
  const pages: unknown[] = [];
  const seen = new Set<string>();
  let current = url;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = await fetchJson(current);
    const players = extractPlayers(payload);
    console.log(`${name} page ${page}: ${players.length} player record(s)`);
    if (players.length === 0 && pages.length === 0) {
      throw new Error(`${name} returned no player records`);
    }

    const pageIds = players.map((player) =>
      String(player.canonicalPlayerId ?? player.sleeperPlayerId ?? JSON.stringify(player)),
    );
    const newCount = pageIds.filter((id) => !seen.has(id)).length;
    if (pages.length > 0 && newCount === 0) {
      console.log(`${name}: page ${page} repeated already-seen players; stopping pagination`);
      break;
    }
    for (const id of pageIds) {
      seen.add(id);
    }
    pages.push(payload);

    const next = nextPageUrl(payload, current, page);
    if (!next || next === current) {
      break;
    }
    current = next;
  }

  const payload = mergePagePayloads(pages);
  const access = extractAccess(payload);
  const previewLimit = typeof access?.previewLimit === "number" ? access.previewLimit : null;
  const totalPlayerCount = typeof access?.totalPlayerCount === "number" ? access.totalPlayerCount : null;
  const playerCount = extractPlayers(payload).length;
  if (previewLimit != null && totalPlayerCount != null && playerCount < totalPlayerCount) {
    console.log(
      `${name}: preview limited to ${playerCount} of ${totalPlayerCount} players (previewLimit=${previewLimit})`,
    );
  }

  return { name, url, payload, pagesFetched: pages.length };
}

function sourceMeta(fetched: FetchedSource): StatdunkSourceMeta {
  const access = extractAccess(fetched.payload);
  const players = extractPlayers(fetched.payload);
  const previewLimit = typeof access?.previewLimit === "number" ? access.previewLimit : null;
  const totalPlayerCount = typeof access?.totalPlayerCount === "number" ? access.totalPlayerCount : players.length;
  return {
    name: fetched.name,
    url: fetched.url,
    playerCount: players.length,
    totalPlayerCount,
    previewLimited: previewLimit != null && totalPlayerCount != null && players.length < totalPlayerCount,
    publication: extractPublication(fetched.payload),
    access,
  };
}

function rawFileName(url: string) {
  const parsed = new URL(url);
  const base = parsed.pathname.split("/").filter(Boolean).at(-1) ?? "response";
  const surface = parsed.searchParams.get("surface");
  const mode = parsed.searchParams.get("mode");
  const suffix = [surface, mode].filter(Boolean).join("-");
  return suffix ? `${base}-${suffix}.json` : `${base}.json`;
}

async function main() {
  const root = process.cwd();
  const dataDir = path.join(root, "data", "statdunk");
  const rawDir = path.join(dataDir, "raw");
  await mkdir(rawDir, { recursive: true });

  const [v3, table] = await Promise.all([
    fetchAllPages(V3_URL, "v3LockIn"),
    fetchAllPages(TABLE_URL, "projectionTable"),
  ]);

  await writeFile(path.join(rawDir, rawFileName(v3.url)), `${JSON.stringify(v3.payload, null, 2)}\n`, "utf8");
  await writeFile(path.join(rawDir, rawFileName(table.url)), `${JSON.stringify(table.payload, null, 2)}\n`, "utf8");
  console.log(`Wrote raw responses to ${path.relative(root, rawDir)}`);

  const dataset = buildLockInDataset({
    v3Payload: v3.payload,
    tablePayload: table.payload,
    v3Meta: sourceMeta(v3),
    tableMeta: sourceMeta(table),
  });

  const jsonPath = path.join(dataDir, "statdunk-lock-in.json");
  const csvPath = path.join(dataDir, "statdunk-lock-in.csv");
  await writeFile(jsonPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${datasetToCsv(dataset)}\n`, "utf8");

  console.log(`Normalized ${dataset.players.length} players`);
  console.log(`JSON ${path.relative(root, jsonPath)}`);
  console.log(`CSV ${path.relative(root, csvPath)}`);
  console.log(`Join keys: ${dataset.joinKeys.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
