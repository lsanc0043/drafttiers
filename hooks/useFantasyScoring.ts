"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FANTASY_SCORING,
  parseFantasyScoring,
  type FantasyScoring,
} from "@/lib/nba/fantasy";

const STORAGE_KEY = "drafttiers.fantasy-scoring";

export function loadFantasyScoring(): FantasyScoring {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FANTASY_SCORING };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return parseFantasyScoring(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_FANTASY_SCORING };
  }
}

export function saveFantasyScoring(scoring: FantasyScoring) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scoring));
}

export function useFantasyScoring() {
  const [scoring, setScoring] = useState<FantasyScoring>(DEFAULT_FANTASY_SCORING);

  useEffect(() => {
    setScoring(loadFantasyScoring());
  }, []);

  function update(next: FantasyScoring) {
    const parsed = parseFantasyScoring(next);
    saveFantasyScoring(parsed);
    setScoring(parsed);
  }

  function reset() {
    update(DEFAULT_FANTASY_SCORING);
  }

  return { scoring, update, reset };
}
