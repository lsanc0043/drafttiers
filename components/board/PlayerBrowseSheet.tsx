"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type PlayerBrowseSheetProps = {
  children: ReactNode;
  desktopWidthPct: number;
  snap: "half" | "full";
  onSnap: (snap: "half" | "full") => void;
  onHide: () => void;
};

function chromeBottom() {
  const nav = document.querySelector("[data-app-nav]");
  const title = document.querySelector("[data-board-chrome]");
  const navBottom = nav?.getBoundingClientRect().bottom ?? 56;
  const titleBottom = title?.getBoundingClientRect().bottom ?? 0;
  return Math.max(navBottom, titleBottom) + 8;
}

export function PlayerBrowseSheet({
  children,
  desktopWidthPct,
  snap,
  onSnap,
  onHide,
}: PlayerBrowseSheetProps) {
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fullTop, setFullTop] = useState(64);

  useEffect(() => {
    function measure() {
      setFullTop(chromeBottom());
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [snap]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    startY.current = event.clientY;
    setDy(0);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (startY.current == null) {
      return;
    }
    const next = event.clientY - startY.current;
    setDy(snap === "full" ? Math.max(0, next) : next);
  }

  function endDrag() {
    const delta = dy;
    startY.current = null;
    setDragging(false);
    setDy(0);
    if (delta < -40) {
      onSnap("full");
      return;
    }
    if (delta > 40) {
      if (snap === "full") {
        onSnap("half");
        return;
      }
      onHide();
    }
  }

  return (
    <aside
      className={`flex min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:rounded-t-3xl max-md:border max-md:border-zinc-200 max-md:shadow-[0_-8px_30px_rgba(0,0,0,0.18)] dark:max-md:border-zinc-800 md:relative md:!top-auto md:h-full md:w-[var(--browse-width)] md:min-w-[50%] md:rounded-none md:border-0 md:bg-transparent md:pl-3 md:shadow-none ${
        snap === "full" ? "max-md:h-auto" : "max-md:top-auto max-md:h-[50dvh]"
      } ${dragging ? "" : "max-md:transition-[height,top,transform] max-md:duration-200"}`}
      style={{
        ["--browse-width" as string]: `${desktopWidthPct}%`,
        transform: dy ? `translateY(${dy}px)` : undefined,
        ...(snap === "full" ? { top: fullTop } : {}),
      }}
    >
      <div
        className="flex shrink-0 touch-none items-center justify-between px-4 pt-2 pb-2 md:hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="w-16" />
        <div className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        <button
          type="button"
          onClick={onHide}
          onPointerDown={(event) => event.stopPropagation()}
          className="w-16 text-right text-sm font-medium text-zinc-600 dark:text-zinc-300"
        >
          Hide
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-0 md:pb-0">
        {children}
      </div>
    </aside>
  );
}
