import { parseRosterRequirements } from "@/lib/sleeper/roster/parse";
import { sleeperGetJson } from "@/lib/sleeper/client";
import { withNbaFantasyPositions } from "@/lib/sleeper/nba-fantasy-positions";
import { parseGraphqlDraft, parseRestDraft } from "@/lib/sleeper/tracker/parser";
import type { DraftSnapshot, SleeperGraphqlDraftPayload } from "@/lib/sleeper/tracker/types";

export const SLEEPER_GRAPHQL_URL = "https://sleeper.com/graphql";

export function buildGetDraftQuery(draftId: string) {
  if (!/^\d{6,}$/.test(draftId)) {
    throw new Error("Invalid Sleeper draft ID");
  }

  return `query get_draft {
  get_draft(
    sport: "nba",
    draft_id: "${draftId}"
  ) {
    created
    creators
    draft_id
    draft_order
    last_message_time
    last_message_id
    last_picked
    league_id
    metadata
    season
    season_type
    settings
    sport
    status
    start_time
    type
  }

  user_drafts_by_draft(
    draft_id: "${draftId}"
  ) {
    user_id
    user_display_name
    user_avatar
    user_is_bot
    metadata
  }

  draft_picks(
    draft_id: "${draftId}"
  ) {
    draft_id
    pick_no
    player_id
    picked_by
    is_keeper
    metadata
    reactions
  }
}`;
}

export type GraphqlFetchResult = {
  ok: boolean;
  status: number;
  payload: SleeperGraphqlDraftPayload | null;
};

export async function fetchGetDraftGraphql(
  draftId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GraphqlFetchResult> {
  const response = await fetchImpl(SLEEPER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      operationName: "get_draft",
      query: buildGetDraftQuery(draftId),
    }),
  });

  const payload = (await response.json().catch(() => null)) as SleeperGraphqlDraftPayload | null;
  return { ok: response.ok, status: response.status, payload };
}

async function loadLeagueRoster(leagueId: string | null | undefined, draftId: string) {
  for (const id of [leagueId, draftId]) {
    if (!id) {
      continue;
    }
    try {
      const league = await sleeperGetJson<{
        roster_positions?: unknown;
        settings?: Record<string, unknown> | null;
        total_rosters?: number | null;
      }>(`/league/${id}`);
      if (league && Array.isArray(league.roster_positions)) {
        return {
          rosterPositions: league.roster_positions.map((position) => String(position)),
          teams: league.total_rosters ?? league.settings?.num_teams ?? null,
          rounds: league.settings?.draft_rounds ?? null,
        };
      }
    } catch {
      // Mock drafts and unknown ids should still track from draft.settings.
    }
  }
  return { rosterPositions: null, teams: null, rounds: null };
}

function withLeagueRoster(
  snapshot: DraftSnapshot,
  league: Awaited<ReturnType<typeof loadLeagueRoster>>,
): DraftSnapshot {
  return {
    ...snapshot,
    rosterPositions: league.rosterPositions,
    rosterRequirements: parseRosterRequirements({
      settings: snapshot.settings,
      rosterPositions: league.rosterPositions,
      teams: snapshot.rosterRequirements.teams || league.teams,
      rounds: snapshot.rosterRequirements.rounds || league.rounds,
    }),
  };
}

export async function fetchDraftSnapshot(draftId: string): Promise<{
  snapshot: DraftSnapshot;
  source: "graphql" | "rest";
}> {
  try {
    const graphql = await fetchGetDraftGraphql(draftId);
    const picks = graphql.payload?.data?.draft_picks;
    if (
      graphql.ok &&
      !graphql.payload?.errors &&
      graphql.payload?.data?.get_draft &&
      Array.isArray(picks)
    ) {
      const parsed = parseGraphqlDraft(graphql.payload, draftId);
      const league = await loadLeagueRoster(parsed.leagueId, draftId);
      const snapshot = withLeagueRoster(parsed, league);
      return {
        snapshot: {
          ...snapshot,
          picks: await withNbaFantasyPositions(snapshot.picks),
        },
        source: "graphql" as const,
      };
    }
  } catch {
    // Fall back to the public draft API; this prototype never collects session credentials.
  }

  const [draft, picks] = await Promise.all([
    sleeperGetJson<{
      draft_id?: string;
      status?: string | null;
      type?: string | null;
      league_id?: string | null;
      settings?: Record<string, unknown> | { teams?: number | null } | null;
    }>(`/draft/${draftId}`),
    sleeperGetJson<Array<{
      pick_no?: number;
      round?: number | null;
      draft_slot?: number | null;
      player_id?: string | number | null;
      picked_by?: string | null;
      is_keeper?: boolean | null;
      metadata?: unknown;
    }>>(`/draft/${draftId}/picks`),
  ]);

  if (!draft && !picks) {
    throw new Error("Sleeper draft not found");
  }

  const parsed = parseRestDraft(draft, picks, draftId);
  const league = await loadLeagueRoster(parsed.leagueId ?? draft?.league_id, draftId);
  const snapshot = withLeagueRoster(parsed, league);
  return {
    snapshot: {
      ...snapshot,
      picks: await withNbaFantasyPositions(snapshot.picks),
    },
    source: "rest",
  };
}
