"use client";

import { useEffect, useState } from "react";
import type { SleeperNewsItem } from "@/lib/sleeper/news";

type PlayerNewsTabProps = {
  fullName: string;
  teamAbbr: string | null;
  sleeperPlayerId?: string | null;
};

function formatPublished(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PlayerNewsTab({
  fullName,
  teamAbbr,
  sleeperPlayerId,
}: PlayerNewsTabProps) {
  const [news, setNews] = useState<SleeperNewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (sleeperPlayerId) {
      params.set("sleeperPlayerId", sleeperPlayerId);
    }
    params.set("name", fullName);
    if (teamAbbr) {
      params.set("team", teamAbbr);
    }
    setNews(null);
    setError(null);
    fetch(`/api/sleeper/news?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          news?: SleeperNewsItem[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load news");
        }
        setNews(payload.news ?? []);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load news");
      });
    return () => controller.abort();
  }, [fullName, sleeperPlayerId, teamAbbr]);

  if (error) {
    return <p className="mt-2 text-sm text-red-600">{error}</p>;
  }
  if (!news) {
    return <p className="mt-2 text-sm text-zinc-500">Loading news...</p>;
  }
  if (news.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">No Sleeper news for this player.</p>;
  }

  return (
    <ul className="mt-2 space-y-3 overflow-y-auto md:min-h-0 md:flex-1">
      {news.map((item, index) => (
        <li
          key={`${item.playerId ?? "news"}-${item.publishedAt ?? index}`}
          className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium">{item.title}</h4>
            <p className="text-xs text-zinc-500">
              {[item.source, formatPublished(item.publishedAt)].filter(Boolean).join(" · ")}
            </p>
          </div>
          {item.description ? (
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.description}</p>
          ) : null}
          {item.analysis ? (
            <p className="mt-2 text-sm text-zinc-500">{item.analysis}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
