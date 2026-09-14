"use client";

import { useEffect, useState } from "react";

type ConfirmModalProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
};

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, working]);

  async function confirm() {
    if (working) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await onConfirm();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Something went wrong");
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close confirmation"
        disabled={working}
        onClick={() => {
          if (!working) {
            onClose();
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-background p-6 shadow-2xl dark:border-zinc-800"
      >
        <h2 id="confirm-modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">{description}</p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={working}
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => void confirm()}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {working ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
