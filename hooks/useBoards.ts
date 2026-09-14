"use client";

import { useEffect, useState } from "react";
import type { BoardSummary } from "@/types";

export function useBoards() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/boards", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load boards");
        }
        const payload = (await response.json()) as { boards: BoardSummary[] };
        setBoards(payload.boards);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setBoards([]);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  return { boards, isLoading };
}
