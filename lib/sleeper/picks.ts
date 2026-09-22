export const EXAMPLE_SLEEPER_DRAFT_ID = "1280302406235602944";

export type SleeperDraftPick = {
  draft_id?: string;
  pick_no?: number;
  round?: number;
  draft_slot?: number;
  picked_by?: string | null;
  player_id?: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    team?: string;
    position?: string;
    fantasy_positions?: string[];
  } | null;
};

const SUFFIX = /^(jr|sr|ii|iii|iv|v)$/;

export function normalizePlayerName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’.]/g, "")
    .replace(/[-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function sleeperPickName(pick: SleeperDraftPick) {
  const first = pick.metadata?.first_name?.trim() ?? "";
  const last = pick.metadata?.last_name?.trim() ?? "";
  return `${first} ${last}`.trim();
}

function nameKeys(fullName: string) {
  const normalized = normalizePlayerName(fullName);
  const parts = normalized.split(" ").filter(Boolean);
  const withoutSuffix = parts.filter((part) => !SUFFIX.test(part));
  const keys = new Set<string>([normalized, withoutSuffix.join(" ")]);
  if (withoutSuffix.length >= 2) {
    keys.add(`${withoutSuffix[0]} ${withoutSuffix[withoutSuffix.length - 1]}`);
    keys.add(withoutSuffix[withoutSuffix.length - 1] ?? "");
  }
  keys.delete("");
  return keys;
}

export function matchPickedPlayerIds(
  picks: SleeperDraftPick[],
  players: Array<{ playerId: string; fullName: string }>,
) {
  const picked = new Set<string>();
  for (const pick of picks) {
    const matched = matchSleeperPickToPlayer(pick, players);
    if (matched) {
      picked.add(matched.playerId);
    }
  }
  return picked;
}

export function matchSleeperPickToPlayer<T extends { playerId: string; fullName: string }>(
  pick: SleeperDraftPick,
  players: T[],
) {
  const exact = new Map<string, T[]>();
  const lastNames = new Map<string, T[]>();

  for (const player of players) {
    const keys = nameKeys(player.fullName);
    for (const key of keys) {
      const list = exact.get(key) ?? [];
      list.push(player);
      exact.set(key, list);
    }
    const last = normalizePlayerName(player.fullName).split(" ").filter((part) => !SUFFIX.test(part)).at(-1);
    if (last) {
      const list = lastNames.get(last) ?? [];
      list.push(player);
      lastNames.set(last, list);
    }
  }

  const keys = [...nameKeys(sleeperPickName(pick))];
  for (const key of keys) {
    const matches = exact.get(key);
    if (matches?.length === 1) {
      return matches[0];
    }
  }
  const last = keys.at(-1);
  const matches = last ? lastNames.get(last) : undefined;
  if (matches?.length === 1) {
    return matches[0];
  }
  return undefined;
}

export function parseDraftPosition(value: string, teamCount?: number | null) {
  const position = Number(value);
  if (!Number.isInteger(position) || position < 1 || position > 30) {
    return null;
  }
  if (teamCount != null && Number.isInteger(teamCount) && position > teamCount) {
    return null;
  }
  return position;
}

export function draftSlotForPickNo(
  pickNo: number,
  teamCount: number,
  draftType: string | null | undefined,
) {
  if (!Number.isInteger(pickNo) || pickNo < 1 || !Number.isInteger(teamCount) || teamCount < 1) {
    return null;
  }
  const index = (pickNo - 1) % teamCount;
  const round = Math.floor((pickNo - 1) / teamCount);
  const type = String(draftType ?? "SNAKE").toUpperCase();
  if (type === "LINEAR" || type === "CUSTOM") {
    return index + 1;
  }
  return round % 2 === 0 ? index + 1 : teamCount - index;
}

export function pickBelongsToDraftPosition(
  pick: SleeperDraftPick,
  draftPosition: number,
  teamCount?: number | null,
  draftType?: string | null,
) {
  if (pick.draft_slot != null && Number.isInteger(pick.draft_slot)) {
    return pick.draft_slot === draftPosition;
  }
  const pickNo = pick.pick_no;
  if (pickNo == null || teamCount == null) {
    return false;
  }
  return draftSlotForPickNo(pickNo, teamCount, draftType) === draftPosition;
}

export function matchUserDraftedPlayerIds(
  picks: SleeperDraftPick[],
  players: Array<{ playerId: string; fullName: string }>,
  draftPosition: number | null,
  teamCount?: number | null,
  draftType?: string | null,
) {
  if (draftPosition == null) {
    return new Set<string>();
  }
  return matchPickedPlayerIds(
    picks.filter((pick) => pickBelongsToDraftPosition(pick, draftPosition, teamCount, draftType)),
    players,
  );
}

export function latestSleeperPick(picks: SleeperDraftPick[]) {
  if (picks.length === 0) {
    return null;
  }
  return picks.reduce((latest, pick) =>
    (pick.pick_no ?? 0) > (latest.pick_no ?? 0) ? pick : latest,
  );
}
