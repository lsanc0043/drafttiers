const SNOWFLAKE = /\d{6,}/;
const SLEEPER_HOSTS = new Set(["sleeper.com", "sleeper.app"]);

export function parseSleeperId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const fromDraftUrl = parseSleeperDraftUrl(trimmed);
  if (fromDraftUrl) {
    return fromDraftUrl;
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const leagueIndex = parts.findIndex((part) => part === "league" || part === "leagues");
    if (leagueIndex >= 0) {
      const fromPath = parts[leagueIndex + 1];
      if (fromPath && SNOWFLAKE.test(fromPath)) {
        return fromPath.match(SNOWFLAKE)?.[0] ?? fromPath;
      }
    }

    for (const key of ["draft_id", "draftId", "league_id", "leagueId"]) {
      const value = url.searchParams.get(key);
      if (value && SNOWFLAKE.test(value)) {
        return value.match(SNOWFLAKE)?.[0] ?? value;
      }
    }
  } catch {
    // pasted a raw id
  }

  const match = trimmed.match(SNOWFLAKE);
  return match?.[0] ?? trimmed;
}

export function parseSleeperDraftUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!SLEEPER_HOSTS.has(host)) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const draftIndex = parts.findIndex((part) => part === "draft" || part === "drafts");
    if (draftIndex < 0) {
      return null;
    }
    const fromPath = parts.find((part, index) => index > draftIndex && SNOWFLAKE.test(part));
    return fromPath?.match(SNOWFLAKE)?.[0] ?? null;
  } catch {
    return null;
  }
}

export function parseSleeperNbaDraftUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!SLEEPER_HOSTS.has(host)) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const draftIndex = parts.findIndex((part) => part === "draft" || part === "drafts");
    if (draftIndex < 0) {
      return null;
    }
    const sport = parts[draftIndex + 1];
    if (sport?.toLowerCase() !== "nba") {
      return null;
    }
    const fromPath = parts.find((part, index) => index > draftIndex + 1 && SNOWFLAKE.test(part));
    return fromPath?.match(SNOWFLAKE)?.[0] ?? null;
  } catch {
    return null;
  }
}
