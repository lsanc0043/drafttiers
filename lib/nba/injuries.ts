const ESPN_INJURIES_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";
const CACHE_MS = 15 * 60 * 1000;

const ESPN_TEAM_TO_NBA: Record<string, string> = {
  GS: "GSW",
  NY: "NYK",
  SA: "SAS",
  NO: "NOP",
  UTAH: "UTA",
  WSH: "WAS",
  PHO: "PHX",
  NJ: "BKN",
  BK: "BKN",
};

const HEALTHY_STATUSES = new Set(["probable", "available", "active", "healthy"]);

export type InjuryLabel = "GTD" | "DTD" | "OUT";

export type InjuryRecord = {
  nameKey: string;
  teamAbbr: string | null;
  status: string;
  label: InjuryLabel;
  url: string | null;
};

export type InjuryIndex = {
  byName: Map<string, InjuryRecord[]>;
};

type InjuryPlayer = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  teamAbbr: string | null;
};

let cache: { at: number; index: InjuryIndex } | null = null;

export function resetInjuryCacheForTests() {
  cache = null;
}

export function emptyInjuryIndex(): InjuryIndex {
  return { byName: new Map() };
}

export function normalizePlayerName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalTeamAbbr(abbr: string | null | undefined) {
  if (!abbr) {
    return null;
  }
  const normalized = abbr.trim().toUpperCase();
  return ESPN_TEAM_TO_NBA[normalized] ?? normalized;
}

export function isInjuredStatus(status: string | null | undefined) {
  if (!status?.trim()) {
    return false;
  }
  return !HEALTHY_STATUSES.has(status.trim().toLowerCase());
}

export function injuryStatusLabel(status: string | null | undefined): InjuryLabel {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (
    normalized === "out" ||
    normalized === "ir" ||
    normalized.includes("injured reserve") ||
    normalized.includes("out for season") ||
    normalized === "ofs"
  ) {
    return "OUT";
  }
  if (
    normalized === "dtd" ||
    normalized === "day-to-day" ||
    normalized === "day to day" ||
    normalized.includes("day-to-day") ||
    normalized.includes("day to day")
  ) {
    return "DTD";
  }
  return "GTD";
}

export function espnTeamInjuriesUrl(team: {
  abbreviation?: unknown;
  slug?: unknown;
  links?: unknown;
} | null | undefined) {
  if (!team) {
    return null;
  }

  const abbr =
    typeof team.abbreviation === "string" ? team.abbreviation.trim().toLowerCase() : "";
  const slug = typeof team.slug === "string" ? team.slug.trim().toLowerCase() : "";
  if (abbr && slug) {
    return `https://www.espn.com/nba/team/injuries/_/name/${abbr}/${slug}`;
  }

  const hrefs = Array.isArray(team.links)
    ? team.links.flatMap((link) => {
        if (!link || typeof link !== "object" || !("href" in link)) {
          return [];
        }
        const href = String(link.href);
        return href.startsWith("http") ? [href] : [];
      })
    : [];

  const clubhouse = hrefs.find((href) => /\/nba\/team\/_\/name\//i.test(href));
  if (clubhouse) {
    return clubhouse.replace(/\/nba\/team\/_\/name\//i, "/nba/team/injuries/_/name/");
  }

  const named = hrefs.find((href) => /\/nba\/team\/[^/]+\/_\/name\//i.test(href));
  if (named) {
    return named.replace(/\/nba\/team\/[^/]+\/_\/name\//i, "/nba/team/injuries/_/name/");
  }

  return null;
}

export function parseEspnInjuries(raw: unknown): InjuryIndex {
  const index = emptyInjuryIndex();
  if (!raw || typeof raw !== "object") {
    return index;
  }

  const teams = (raw as { injuries?: unknown }).injuries;
  if (!Array.isArray(teams)) {
    return index;
  }

  for (const team of teams) {
    if (!team || typeof team !== "object") {
      continue;
    }
    const entries = (team as { injuries?: unknown }).injuries;
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const row = entry as {
        status?: unknown;
        athlete?: {
          displayName?: unknown;
          firstName?: unknown;
          lastName?: unknown;
          team?: {
            abbreviation?: unknown;
            slug?: unknown;
            links?: unknown;
          };
        };
      };
      const status = typeof row.status === "string" ? row.status : "";
      if (!isInjuredStatus(status)) {
        continue;
      }

      const athlete = row.athlete ?? {};
      const displayName =
        typeof athlete.displayName === "string"
          ? athlete.displayName
          : [athlete.firstName, athlete.lastName].filter((part) => typeof part === "string").join(" ");
      const nameKey = normalizePlayerName(displayName);
      if (!nameKey) {
        continue;
      }

      const teamAbbr = canonicalTeamAbbr(
        typeof athlete.team?.abbreviation === "string" ? athlete.team.abbreviation : null,
      );
      const record: InjuryRecord = {
        nameKey,
        teamAbbr,
        status,
        label: injuryStatusLabel(status),
        url: espnTeamInjuriesUrl(athlete.team),
      };
      const list = index.byName.get(nameKey) ?? [];
      list.push(record);
      index.byName.set(nameKey, list);
    }
  }

  return index;
}

export function getPlayerInjury(player: InjuryPlayer, index: InjuryIndex): InjuryRecord | null {
  const keys = new Set<string>([normalizePlayerName(player.fullName)]);
  if (player.firstName && player.lastName) {
    keys.add(normalizePlayerName(`${player.firstName} ${player.lastName}`));
  }

  const playerTeam = canonicalTeamAbbr(player.teamAbbr);
  for (const key of keys) {
    const records = index.byName.get(key);
    if (!records?.length) {
      continue;
    }
    const match = records.find(
      (record) => !record.teamAbbr || !playerTeam || record.teamAbbr === playerTeam,
    );
    if (match) {
      return match;
    }
  }

  return null;
}

export function isPlayerInjured(player: InjuryPlayer, index: InjuryIndex) {
  return getPlayerInjury(player, index) != null;
}

export async function getInjuryIndex(
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<InjuryIndex> {
  const now = options.now?.() ?? Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return cache.index;
  }

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(ESPN_INJURIES_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Injury feed failed with ${response.status}`);
    }
    const index = parseEspnInjuries(await response.json());
    cache = { at: now, index };
    return index;
  } catch {
    return cache?.index ?? emptyInjuryIndex();
  }
}

export function applyInjuryFlags<T extends InjuryPlayer>(players: T[], index: InjuryIndex) {
  return players.map((player) => {
    const injury = getPlayerInjury(player, index);
    return {
      ...player,
      isInjured: injury != null,
      injuryLabel: injury?.label ?? null,
      injuryUrl: injury?.url ?? null,
    };
  });
}
