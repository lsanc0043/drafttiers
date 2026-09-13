"use client";

import { useState } from "react";
import { nbaHeadshotUrl, playerInitials } from "@/lib/nba/headshot";

type PlayerPhotoProps = {
  nbaPersonId: number;
  fullName: string;
  size: "card" | "modal";
};

export function PlayerPhoto({ nbaPersonId, fullName, size }: PlayerPhotoProps) {
  const [failed, setFailed] = useState(false);
  const isModal = size === "modal";

  const frameClass = isModal
    ? "h-24 w-24 text-2xl sm:h-32 sm:w-32 sm:text-3xl md:h-40 md:w-40 lg:h-48 lg:w-48 lg:text-4xl"
    : "h-28 w-28 text-xl";

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 ${frameClass}`}
        aria-hidden="true"
      >
        {playerInitials(fullName)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={nbaHeadshotUrl(nbaPersonId, isModal ? "large" : "small")}
      alt=""
      className={`rounded-full object-cover object-top ${frameClass}`}
      onError={() => setFailed(true)}
    />
  );
}
