"use client";

import { useState } from "react";
import { nbaHeadshotUrl, playerInitials } from "@/lib/nba/headshot";

type PlayerPhotoProps = {
  nbaPersonId: number | null;
  fullName: string;
  size: "card" | "modal" | "compact";
  photoSize?: number;
};

export function PlayerPhoto({ nbaPersonId, fullName, size, photoSize }: PlayerPhotoProps) {
  const [failed, setFailed] = useState(false);
  const isModal = size === "modal";
  const isCompact = size === "compact";

  const frameClass = isModal
    ? "h-24 w-24 text-2xl sm:h-32 sm:w-32 sm:text-3xl md:h-40 md:w-40 lg:h-48 lg:w-48 lg:text-4xl"
    : isCompact
      ? "text-sm"
      : "h-28 w-28 text-xl";
  const frameStyle =
    isCompact && photoSize
      ? { width: photoSize, height: photoSize }
      : isCompact
        ? { width: 64, height: 64 }
        : undefined;

  if (nbaPersonId == null || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 ${frameClass}`}
        style={frameStyle}
        aria-hidden="true"
      >
        {playerInitials(fullName)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={nbaHeadshotUrl(nbaPersonId, isModal || (photoSize != null && photoSize >= 96) ? "large" : "small")}
      alt=""
      draggable={false}
      className={`rounded-full object-cover object-top ${frameClass}`}
      style={frameStyle}
      onError={() => setFailed(true)}
    />
  );
}
