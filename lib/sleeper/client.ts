const DEFAULT_BASE_URL = "https://api.sleeper.app/v1";

export function getSleeperBaseUrl() {
  return process.env.SLEEPER_API_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function sleeperFetch(path: string): Promise<Response> {
  const url = `${getSleeperBaseUrl()}${path}`;
  return fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
}
