"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FANTASY_SCORING,
  FANTASY_SCORING_FIELDS,
  parseFantasyScoring,
  scoringToForm,
  type FantasyScoring,
} from "@/lib/nba/fantasy";

type FantasyScoringModalProps = {
  scoring: FantasyScoring;
  onSave: (scoring: FantasyScoring) => void;
  onClose: () => void;
};

export function FantasyScoringModal({ scoring, onSave, onClose }: FantasyScoringModalProps) {
  const [draft, setDraft] = useState(scoringToForm(scoring));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  function onChange(key: keyof FantasyScoring, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close fantasy scoring"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fantasy-scoring-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-background p-6 shadow-2xl dark:border-zinc-800"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          Close
        </button>
        <h2 id="fantasy-scoring-title" className="text-lg font-semibold">
          Fantasy scoring
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          These values apply to FPTS on player game logs. TF and FF are kept for later; game logs do
          not include those fouls yet.
        </p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(parseFantasyScoring(draft));
            onClose();
          }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FANTASY_SCORING_FIELDS.map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="text-zinc-500">{field.label}</span>
                <input
                  type="number"
                  step="any"
                  value={draft[field.key]}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
                />
                {field.hint ? <span className="mt-1 block text-xs text-zinc-500">{field.hint}</span> : null}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setDraft(scoringToForm(DEFAULT_FANTASY_SCORING))}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Reset defaults
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
