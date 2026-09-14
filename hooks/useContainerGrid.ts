"use client";

import { useEffect, useState } from "react";

export function useContainerGrid(minCardWidth = 132, gap = 12, rows = 4) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setWidth(nextWidth);
    });
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [node]);

  const columns = Math.max(
    1,
    Math.min(6, Math.floor((width + gap) / (minCardWidth + gap)) || 1),
  );
  const nextPageSize = Math.min(100, Math.max(columns * 2, columns * rows));
  const cardWidth = width > 0 ? (width - gap * Math.max(0, columns - 1)) / columns : minCardWidth;
  const photoSize = Math.round(Math.min(112, Math.max(48, cardWidth * 0.42)));

  useEffect(() => {
    const timer = window.setTimeout(() => setPageSize(nextPageSize), 120);
    return () => window.clearTimeout(timer);
  }, [nextPageSize]);

  return { setNode, width, columns, pageSize, photoSize };
}
