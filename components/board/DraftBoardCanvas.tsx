"use client";

import type { ReactNode } from "react";

type DraftBoardCanvasProps = {
  children?: ReactNode;
};

export function DraftBoardCanvas({ children }: DraftBoardCanvasProps) {
  return (
    <section className="min-h-[12rem] rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      {children ?? (
        <p className="text-sm text-zinc-500">Draft board canvas placeholder</p>
      )}
    </section>
  );
}
