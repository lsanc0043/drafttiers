import type { RosterRequirements } from "@/lib/sleeper/roster/types";

export type DraftPick = {
  pickNo: number;
  playerId: string;
  pickedBy: string | null;
  draftSlot: number | null;
  round: number | null;
  isKeeper?: boolean | null;
  metadata?: unknown;
};

export type DraftSnapshot = {
  draftId: string;
  status: string;
  picks: DraftPick[];
  teams: number | null;
  draftType: string | null;
  leagueId: string | null;
  settings: Record<string, unknown> | null;
  rosterPositions: string[] | null;
  users: Array<{ userId: string; displayName: string }>;
  rosterRequirements: RosterRequirements;
};

export type DraftDiff = {
  added: DraftPick[];
  removed: DraftPick[];
  changed: Array<{
    previous: DraftPick;
    current: DraftPick;
  }>;
};

export type SleeperGraphqlDraftPayload = {
  data?: {
    get_draft?: {
      draft_id?: string;
      status?: string | null;
      last_picked?: number | null;
      sport?: string | null;
      type?: string | null;
      league_id?: string | null;
      settings?: Record<string, unknown> | { teams?: number | null } | null;
    } | null;
    draft_picks?: Array<{
      draft_id?: string;
      pick_no?: number;
      round?: number | null;
      draft_slot?: number | null;
      player_id?: string | number | null;
      picked_by?: string | null;
      is_keeper?: boolean | null;
      metadata?: unknown;
      reactions?: unknown;
    }> | null;
    user_drafts_by_draft?: unknown;
  } | null;
  errors?: unknown;
};
