"use client";

import { useEffect, useState } from "react";
import {
  peekPlayerDropHover,
  peekTierDropHover,
  subscribePlayerDropHover,
  subscribeTierDropHover,
} from "@/lib/board-drop-hover";

export function usePlayerDropHover() {
  const [dest, setDest] = useState(peekPlayerDropHover);
  useEffect(() => subscribePlayerDropHover(() => setDest(peekPlayerDropHover())), []);
  return dest;
}

export function useTierDropHover() {
  const [dest, setDest] = useState(peekTierDropHover);
  useEffect(() => subscribeTierDropHover(() => setDest(peekTierDropHover())), []);
  return dest;
}
