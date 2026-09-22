import { DEFAULT_FANTASY_SCORING, type FantasyScoring } from "@/lib/nba/fantasy";
import { sleeperGetJson } from "@/lib/sleeper/client";
import { parseSleeperId } from "@/lib/sleeper/ids";
import type { DraftSettingsInput } from "@/lib/validation";

type SleeperDraft = {
  draft_id?: string;
  league_id?: string | null;
  type?: string | null;
  sport?: string | null;
  metadata?: { name?: string | null } | null;
  settings?: Record<string, unknown> | null;
};

type SleeperLeague = {
  league_id?: string;
  draft_id?: string | null;
  name?: string | null;
  sport?: string | null;
  total_rosters?: number | null;
  scoring_settings?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
};

export type SleeperImportedSettings = {
  sleeperDraftId: string;
  sleeperLeagueId: string | null;
  leagueName: string | null;
  sport: string | null;
  settings: DraftSettingsInput;
};

const SCORING_ALIASES: Record<keyof FantasyScoring, string[]> = {
  points: ["pts", "points"],
  rebounds: ["reb", "rebounds", "trb"],
  assists: ["ast", "assists"],
  blocks: ["blk", "blocks"],
  steals: ["stl", "steals"],
  doubleDouble: ["dd", "double_double"],
  turnover: ["tov", "to", "turnover", "turnovers"],
  threePointer: ["fg3m", "fgm_3", "tpm", "threes"],
  tripleDouble: ["td", "triple_double"],
  technical: ["tf", "tech", "technical"],
  flagrant: ["ff", "flagrant"],
  points40: ["pts_40", "pts40", "bonus_pts_40"],
  points50: ["pts_50", "pts50", "bonus_pts_50"],
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function mapSleeperDraftType(type: unknown): DraftSettingsInput["draftType"] {
  const value = String(type ?? "").toLowerCase();
  if (value === "snake") {
    return "SNAKE";
  }
  if (value === "linear") {
    return "LINEAR";
  }
  return "CUSTOM";
}

export function mapSleeperScoring(
  scoring: unknown,
  fallback: FantasyScoring = DEFAULT_FANTASY_SCORING,
): FantasyScoring {
  const record = asRecord(scoring);
  const next = { ...fallback };

  for (const key of Object.keys(SCORING_ALIASES) as Array<keyof FantasyScoring>) {
    const value = firstNumber(record, SCORING_ALIASES[key]);
    if (value != null) {
      next[key] = value;
    }
  }

  if (next.rebounds === fallback.rebounds && firstNumber(record, ["reb", "rebounds", "trb"]) == null) {
    const offensive = firstNumber(record, ["oreb"]);
    const defensive = firstNumber(record, ["dreb"]);
    if (offensive != null && defensive != null) {
      next.rebounds = offensive + defensive;
    }
  }

  return next;
}

export function mapSleeperDraftSettings(
  draft: SleeperDraft | null,
  league: SleeperLeague | null,
  fallbackScoring: FantasyScoring = DEFAULT_FANTASY_SCORING,
): DraftSettingsInput {
  const draftSettings = asRecord(draft?.settings);
  const leagueSettings = asRecord(league?.settings);

  const teamCount =
    firstNumber(draftSettings, ["teams"]) ??
    (league?.total_rosters != null ? Number(league.total_rosters) : null) ??
    firstNumber(leagueSettings, ["num_teams", "teams"]) ??
    12;

  const roundCount = firstNumber(draftSettings, ["rounds"]) ?? 13;
  const pickTimer = firstNumber(draftSettings, ["pick_timer", "pick_time"]) ?? 90;

  return {
    teamCount: clampInt(teamCount, 2, 30),
    draftPosition: 1,
    roundCount: clampInt(roundCount, 1, 30),
    draftType: mapSleeperDraftType(draft?.type),
    roundTimerSeconds: clampInt(pickTimer === 0 ? 90 : pickTimer, 1, 3600),
    fantasyScoring: mapSleeperScoring(league?.scoring_settings, fallbackScoring),
  };
}

async function loadDraft(id: string) {
  return sleeperGetJson<SleeperDraft>(`/draft/${id}`);
}

async function loadLeague(id: string) {
  return sleeperGetJson<SleeperLeague>(`/league/${id}`);
}

export async function importSleeperDraftSettings(rawId: string): Promise<SleeperImportedSettings> {
  const id = parseSleeperId(rawId);
  if (!id) {
    throw new Error("Enter a Sleeper draft ID");
  }

  let league = await loadLeague(id);
  let draft: SleeperDraft | null = null;

  if (league) {
    if (league.draft_id) {
      draft = await loadDraft(String(league.draft_id));
    }
    if (!draft) {
      const drafts = await sleeperGetJson<SleeperDraft[]>(`/league/${id}/drafts`);
      draft = Array.isArray(drafts) && drafts.length > 0 ? drafts[0] : null;
    }
  } else {
    draft = await loadDraft(id);
    if (draft?.league_id) {
      league = await loadLeague(String(draft.league_id));
    }
  }

  if (!draft && !league) {
    throw new Error("Sleeper draft not found");
  }

  return {
    sleeperDraftId: String(draft?.draft_id ?? id),
    sleeperLeagueId: league?.league_id ? String(league.league_id) : draft?.league_id ? String(draft.league_id) : null,
    leagueName: league?.name ?? draft?.metadata?.name ?? null,
    sport: league?.sport ?? draft?.sport ?? null,
    settings: mapSleeperDraftSettings(draft, league),
  };
}
