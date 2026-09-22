import type { DraftSnapshot } from "@/lib/sleeper/tracker/types";

export async function fetchMockDraftSnapshot(draftId: string) {
  const response = await fetch(`/api/sleeper/mock-draft?draftId=${encodeURIComponent(draftId)}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    snapshot?: DraftSnapshot;
    source?: "graphql" | "rest";
    error?: unknown;
  };
  if (!response.ok || !payload.snapshot) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Could not load Sleeper draft");
  }
  return {
    snapshot: payload.snapshot,
    source: payload.source ?? "rest",
  };
}
