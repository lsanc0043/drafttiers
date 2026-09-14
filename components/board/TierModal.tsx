"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { createBucketSchema, TIER_COLOR_GRAY } from "@/lib/validation";

type TierModalProps = {
  title: string;
  submitLabel: string;
  initialName?: string;
  initialColor?: string;
  onClose: () => void;
  onSave: (input: { name: string; color: string }) => Promise<void>;
};

export function TierModal({
  title,
  submitLabel,
  initialName = "",
  initialColor,
  onClose,
  onSave,
}: TierModalProps) {
  const nameId = useId();
  const colorId = useId();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? TIER_COLOR_GRAY);
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = createBucketSchema.safeParse({ name, color });
    if (!parsed.success) {
      setError("Enter a tier name and a hex color.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: parsed.data.name, color: parsed.data.color });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save tier",
      );
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close tier editor"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-modal-title"
        onSubmit={(event) => void onSubmit(event)}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-background p-6 shadow-2xl dark:border-zinc-800"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          Close
        </button>
        <h2 id="tier-modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor={nameId} className="block text-sm font-medium">
              Name
            </label>
            <input
              id={nameId}
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              placeholder="S"
            />
          </div>
          <div>
            <label htmlFor={colorId} className="block text-sm font-medium">
              Color
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id={colorId}
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
              />
              <input
                value={color}
                aria-label="Hex color"
                onChange={(event) => setColor(event.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm dark:border-zinc-700"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
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
