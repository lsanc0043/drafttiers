const DEFAULT_BASE_URL = "https://api.sleeper.app/v1";

export function getSleeperBaseUrl() {
  return process.env.SLEEPER_API_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function sleeperFetch(path: string): Promise<Response> {
  const url = `${getSleeperBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
}

export async function sleeperGetJson<T>(path: string): Promise<T | null> {
  const response = await sleeperFetch(path);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Sleeper request failed (${response.status})`);
  }

  const body = (await response.json().catch(() => null)) as T | null;
  return body;
}
