import { spawn } from "node:child_process";
import path from "node:path";
import {
  nbaCatalogSchema,
  nbaGameLogSchema,
  nbaPlayerSchema,
  nbaSeasonStatSchema,
  nbaStatsBundleSchema,
  type NbaGameLogInput,
  type NbaPlayerInput,
  type NbaSeasonStatInput,
} from "@/lib/nba/schema";

const DEFAULT_TIMEOUT_MS = 120_000;

export type PythonCatalogResult = {
  players: NbaPlayerInput[];
  fetched: number;
  skipped: number;
  parseFailed: number;
  indexError?: string | null;
};

export function parseNbaCatalog(raw: unknown): PythonCatalogResult {
  const catalog = nbaCatalogSchema.parse(raw);
  const players: NbaPlayerInput[] = [];
  let parseFailed = catalog.skipped;

  for (const row of catalog.players) {
    const parsed = nbaPlayerSchema.safeParse(row);
    if (parsed.success) {
      players.push(parsed.data);
    } else {
      parseFailed += 1;
    }
  }

  return {
    players,
    fetched: players.length,
    skipped: catalog.skipped,
    parseFailed,
    indexError: catalog.indexError,
  };
}

export type PythonStatsResult = {
  seasonStats: NbaSeasonStatInput[];
  gameLogs: NbaGameLogInput[];
  parseFailed: number;
  errors: string[];
  season?: string;
};

export function parseNbaStatsBundle(raw: unknown): PythonStatsResult {
  const catalog = nbaStatsBundleSchema.parse(raw);
  const seasonStats: NbaSeasonStatInput[] = [];
  const gameLogs: NbaGameLogInput[] = [];
  let parseFailed = 0;

  for (const row of catalog.seasonStats) {
    const parsed = nbaSeasonStatSchema.safeParse(row);
    if (parsed.success) {
      seasonStats.push(parsed.data);
    } else {
      parseFailed += 1;
    }
  }

  for (const row of catalog.gameLogs) {
    const parsed = nbaGameLogSchema.safeParse(row);
    if (parsed.success) {
      gameLogs.push(parsed.data);
    } else {
      parseFailed += 1;
    }
  }

  return {
    seasonStats,
    gameLogs,
    parseFailed,
    errors: catalog.errors,
    season: catalog.season,
  };
}

export function runNbaPythonSync(
  options: { pythonBin?: string; cwd?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  return runNbaPythonScript("python/sync_players.py", [], options);
}

export function runNbaStatsPythonSync(
  options: { pythonBin?: string; cwd?: string; timeoutMs?: number; playerId?: number } = {},
): Promise<unknown> {
  const args = options.playerId ? ["--player-id", String(options.playerId)] : [];
  return runNbaPythonScript("python/sync_stats.py", args, {
    ...options,
    timeoutMs: options.timeoutMs ?? 180_000,
  });
}

export function runNbaPythonScript(
  scriptRelativePath: string,
  args: string[] = [],
  options: { pythonBin?: string; cwd?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const pythonBin = options.pythonBin ?? process.env.PYTHON_BIN ?? "python";
  const cwd = options.cwd ?? process.cwd();
  const scriptPath = path.join(cwd, scriptRelativePath);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, ...args], {
      cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`NBA sync timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const details = parseErrorPayload(stderr) ?? stderr.trim() ?? `Python exited with code ${code}`;
        reject(new Error(details));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Python sync returned invalid JSON"));
      }
    });
  });
}

function parseErrorPayload(stderr: string): string | null {
  const line = stderr.trim().split("\n").find((entry) => entry.startsWith("{"));
  if (!line) {
    return null;
  }
  try {
    const payload = JSON.parse(line) as { error?: string };
    return payload.error ?? null;
  } catch {
    return null;
  }
}
