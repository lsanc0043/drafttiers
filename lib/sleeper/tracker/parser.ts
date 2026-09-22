import { draftSlotForPickNo } from "@/lib/sleeper/picks";
import { parseRosterRequirements } from "@/lib/sleeper/roster/parse";
import type { DraftPick, DraftSnapshot, SleeperGraphqlDraftPayload } from "@/lib/sleeper/tracker/types";

function asPositiveInt(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }
  return number;
}

function asPick(input: {
  pick_no?: number;
  round?: number | null;
  draft_slot?: number | null;
  player_id?: string | number | null;
  picked_by?: string | null;
  is_keeper?: boolean | null;
  metadata?: unknown;
}): DraftPick | null {
  const pickNo = Number(input.pick_no);
  if (!Number.isFinite(pickNo) || pickNo <= 0) {
    return null;
  }
  const playerId = input.player_id == null ? "" : String(input.player_id);
  return {
    pickNo,
    playerId,
    pickedBy: input.picked_by ? String(input.picked_by) : null,
    draftSlot: asPositiveInt(input.draft_slot),
    round: asPositiveInt(input.round),
    isKeeper: input.is_keeper ?? null,
    metadata: input.metadata ?? null,
  };
}

function snapshotMeta(
  draft: {
    type?: string | null;
    league_id?: string | null;
    settings?: Record<string, unknown> | { teams?: number | null } | null;
  } | null | undefined,
  extra?: {
    rosterPositions?: string[] | null;
    users?: DraftSnapshot["users"];
  },
) {
  const settings =
    draft?.settings && typeof draft.settings === "object" && !Array.isArray(draft.settings)
      ? (draft.settings as Record<string, unknown>)
      : null;
  const rosterPositions = extra?.rosterPositions ?? null;
  return {
    teams: asPositiveInt(settings?.teams),
    draftType: draft?.type ? String(draft.type) : null,
    leagueId: draft?.league_id ? String(draft.league_id) : null,
    settings,
    rosterPositions,
    users: extra?.users ?? [],
    rosterRequirements: parseRosterRequirements({
      settings,
      rosterPositions,
    }),
  };
}

function parseUsers(value: unknown): DraftSnapshot["users"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const userId = record.user_id == null ? "" : String(record.user_id);
    if (!userId) {
      return [];
    }
    return [
      {
        userId,
        displayName: typeof record.user_display_name === "string" ? record.user_display_name : userId,
      },
    ];
  });
}

function withComputedSlots(snapshot: DraftSnapshot): DraftSnapshot {
  const teams = snapshot.teams;
  if (teams == null) {
    return snapshot;
  }
  return {
    ...snapshot,
    picks: snapshot.picks.map((pick) => ({
      ...pick,
      draftSlot: pick.draftSlot ?? draftSlotForPickNo(pick.pickNo, teams, snapshot.draftType),
      round: pick.round ?? Math.ceil(pick.pickNo / teams),
    })),
  };
}

export function parseGraphqlDraft(payload: SleeperGraphqlDraftPayload, draftId: string): DraftSnapshot {
  const picks = (payload.data?.draft_picks ?? [])
    .map((pick) => asPick(pick ?? {}))
    .filter((pick): pick is DraftPick => pick != null)
    .sort((left, right) => left.pickNo - right.pickNo);

  return withComputedSlots({
    draftId: String(payload.data?.get_draft?.draft_id ?? draftId),
    status: String(payload.data?.get_draft?.status ?? "unknown"),
    picks,
    ...snapshotMeta(payload.data?.get_draft, {
      users: parseUsers(payload.data?.user_drafts_by_draft),
    }),
  });
}

export function parseRestDraft(
  draft: {
    draft_id?: string;
    status?: string | null;
    type?: string | null;
    league_id?: string | null;
    settings?: Record<string, unknown> | { teams?: number | null } | null;
  } | null,
  picks: Array<{
    pick_no?: number;
    round?: number | null;
    draft_slot?: number | null;
    player_id?: string | number | null;
    picked_by?: string | null;
    is_keeper?: boolean | null;
    metadata?: unknown;
  }> | null,
  draftId: string,
  extra?: {
    rosterPositions?: string[] | null;
    users?: DraftSnapshot["users"];
  },
): DraftSnapshot {
  const normalized = (picks ?? [])
    .map((pick) => asPick(pick))
    .filter((pick): pick is DraftPick => pick != null)
    .sort((left, right) => left.pickNo - right.pickNo);

  return withComputedSlots({
    draftId: String(draft?.draft_id ?? draftId),
    status: String(draft?.status ?? "unknown"),
    picks: normalized,
    ...snapshotMeta(draft, extra),
  });
}

export function playerLabel(pick: DraftPick) {
  const metadata = pick.metadata;
  if (!metadata || typeof metadata !== "object") {
    return pick.playerId || "Unknown";
  }
  const record = metadata as Record<string, unknown>;
  const first = typeof record.first_name === "string" ? record.first_name : "";
  const last = typeof record.last_name === "string" ? record.last_name : "";
  const name = `${first} ${last}`.trim();
  return name || pick.playerId || "Unknown";
}

export function playerMeta(pick: DraftPick) {
  const metadata = pick.metadata;
  if (!metadata || typeof metadata !== "object") {
    return { firstName: "", lastName: "", position: "", fantasyPositions: [] as string[], team: "" };
  }
  const record = metadata as Record<string, unknown>;
  const fantasyPositions = Array.isArray(record.fantasy_positions)
    ? record.fantasy_positions.map((part) => String(part).trim()).filter(Boolean)
    : [];
  const position = typeof record.position === "string" ? record.position : "";
  return {
    firstName: typeof record.first_name === "string" ? record.first_name : "",
    lastName: typeof record.last_name === "string" ? record.last_name : "",
    position,
    fantasyPositions,
    team: typeof record.team === "string" ? record.team : "",
  };
}

export function toSleeperDraftPicks(picks: DraftPick[]): Array<{
  pick_no: number;
  round?: number;
  draft_slot?: number;
  picked_by?: string;
  player_id: string;
  metadata: {
    first_name?: string;
    last_name?: string;
    team?: string;
    position?: string;
    fantasy_positions?: string[];
  } | null;
}> {
  return picks.map((pick) => {
    const meta = playerMeta(pick);
    return {
      pick_no: pick.pickNo,
      round: pick.round ?? undefined,
      draft_slot: pick.draftSlot ?? undefined,
      picked_by: pick.pickedBy ?? undefined,
      player_id: pick.playerId,
      metadata: {
        first_name: meta.firstName || undefined,
        last_name: meta.lastName || undefined,
        team: meta.team || undefined,
        position: meta.position || undefined,
        fantasy_positions: meta.fantasyPositions.length > 0 ? meta.fantasyPositions : undefined,
      },
    };
  });
}

