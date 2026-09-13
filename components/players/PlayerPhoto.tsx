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

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 ${
          isModal ? "h-48 w-48 text-4xl" : "h-28 w-28 text-xl"
        }`}
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
      className={`rounded-full object-cover object-top ${isModal ? "h-48 w-48" : "h-28 w-28"}`}
      onError={() => setFailed(true)}
    />
  );
}
