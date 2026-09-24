"use client";

import { useEffect, useState } from "react";

function touchUiQuery() {
  return window.matchMedia("(any-pointer: coarse)");
}

export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const media = touchUiQuery();
    function sync() {
      setCoarse(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return coarse;
}

export function isTouchPointer(event: { pointerType: string }) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

export function isGripDragPointer(event: { pointerType: string }) {
  if (isTouchPointer(event)) {
    return true;
  }
  return event.pointerType === "mouse" && touchUiQuery().matches;
}

export function hapticTap() {
  try {
    navigator.vibrate?.(12);
  } catch {
    // Some browsers throw if vibration is blocked.
  }
}
