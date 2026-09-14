"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  FANTASY_SCORING_FIELDS,
  scoringToForm,
  type FantasyScoring,
} from "@/lib/nba/fantasy";
import { draftSettingsSchema, type DraftSettingsInput } from "@/lib/validation";

type DraftSettingsModalProps = {
  title: string;
  submitLabel: string;
  allowSkip?: boolean;
  skipLabel?: string;
  initialSettings?: DraftSettingsInput | null;
  defaultScoring: FantasyScoring;
  onSkip?: () => Promise<void> | void;
  onSave: (settings: DraftSettingsInput) => Promise<void>;
  onClose: () => void;
};

function emptyNumber(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

export function DraftSettingsModal({
  title,
  submitLabel,
  allowSkip = false,
  skipLabel = "Skip for now",
  initialSettings,
  defaultScoring,
  onSkip,
  onSave,
  onClose,
}: DraftSettingsModalProps) {
  const teamCountId = useId();
  const draftPositionId = useId();
  const roundCountId = useId();
  const draftTypeId = useId();
  const timerId = useId();
  const [teamCount, setTeamCount] = useState(emptyNumber(initialSettings?.teamCount));
  const [draftPosition, setDraftPosition] = useState(emptyNumber(initialSettings?.draftPosition));
  const [roundCount, setRoundCount] = useState(emptyNumber(initialSettings?.roundCount));
  const [draftType, setDraftType] = useState<DraftSettingsInput["draftType"]>(
    initialSettings?.draftType ?? "SNAKE",
  );
  const [roundTimerSeconds, setRoundTimerSeconds] = useState(
    emptyNumber(initialSettings?.roundTimerSeconds),
  );
  const [scoring, setScoring] = useState(
    scoringToForm(initialSettings?.fantasyScoring ?? defaultScoring),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function submitSettings(event: FormEvent) {
    event.preventDefault();
    const parsedScoring = Object.fromEntries(
      Object.entries(scoring).map(([key, value]) => [key, Number(value)]),
    );
    const parsed = draftSettingsSchema.safeParse({
      teamCount: Number(teamCount),
      draftPosition: Number(draftPosition),
      roundCount: Number(roundCount),
      draftType,
      roundTimerSeconds: Number(roundTimerSeconds),
      fantasyScoring: parsedScoring,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first?.message ?? "Fill out every field to save draft settings.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(parsed.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save draft settings");
      setSaving(false);
    }
  }

  async function skip() {
    if (!onSkip) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSkip();
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : "Could not create board");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close draft settings"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-settings-title"
        onSubmit={(event) => void submitSettings(event)}
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
        <h2 id="draft-settings-title" className="pr-12 text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {allowSkip
            ? "Set up your league if you have a draft ready. You can skip this and fill it in later."
            : "All fields are required to save these settings."}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label htmlFor={teamCountId} className="block text-sm">
            <span className="font-medium">Teams in league</span>
            <input
              id={teamCountId}
              type="number"
              min={2}
              max={30}
              required={!allowSkip}
              value={teamCount}
              onChange={(event) => setTeamCount(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label htmlFor={draftPositionId} className="block text-sm">
            <span className="font-medium">Your draft position</span>
            <input
              id={draftPositionId}
              type="number"
              min={1}
              max={30}
              required={!allowSkip}
              value={draftPosition}
              onChange={(event) => setDraftPosition(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label htmlFor={roundCountId} className="block text-sm">
            <span className="font-medium">Rounds</span>
            <input
              id={roundCountId}
              type="number"
              min={1}
              max={30}
              required={!allowSkip}
              value={roundCount}
              onChange={(event) => setRoundCount(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label htmlFor={timerId} className="block text-sm">
            <span className="font-medium">Round timer (seconds)</span>
            <input
              id={timerId}
              type="number"
              min={1}
              max={3600}
              required={!allowSkip}
              value={roundTimerSeconds}
              onChange={(event) => setRoundTimerSeconds(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label htmlFor={draftTypeId} className="block text-sm sm:col-span-2">
            <span className="font-medium">Draft type</span>
            <select
              id={draftTypeId}
              value={draftType}
              onChange={(event) =>
                setDraftType(event.target.value as DraftSettingsInput["draftType"])
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-700"
            >
              <option value="SNAKE">Snake</option>
              <option value="LINEAR">Linear</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Fantasy scoring</legend>
          <p className="mt-1 text-xs text-zinc-500">
            Starts from your current scoring setup. Every value is required if you save settings.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FANTASY_SCORING_FIELDS.map((field) => (
              <label key={field.key} className="block text-sm">
                <span className="text-zinc-500">{field.label}</span>
                <input
                  type="number"
                  step="any"
                  required={!allowSkip}
                  value={scoring[field.key]}
                  onChange={(event) =>
                    setScoring((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
                />
              </label>
            ))}
          </div>
        </fieldset>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {allowSkip ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void skip()}
              className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {skipLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
