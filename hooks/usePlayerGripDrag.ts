"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { hapticTap, isGripDragPointer } from "@/hooks/useCoarsePointer";
import { clearDropHover, setPlayerDropHover } from "@/lib/board-drop-hover";
import { resolvePlayerDropDest, type PlayerDropDest } from "@/lib/board-drop-target";
import {
  setDraggingPlayer,
  takeDraggingPlayer,
  type PlayerCardData,
} from "@/components/players/PlayerCard";

export function usePlayerGripDrag(
  player: PlayerCardData | null,
  onDrop?: (player: PlayerCardData, dest: PlayerDropDest) => void,
) {
  const active = useRef(false);
  const playerRef = useRef(player);
  const onDropRef = useRef(onDrop);
  playerRef.current = player;
  onDropRef.current = onDrop;
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
      clearDropHover();
    };
  }, []);

  function endDrag(event: PointerEvent<HTMLButtonElement>, drop: boolean) {
    if (!active.current) {
      return;
    }
    active.current = false;
    document.body.style.overflow = "";
    const card = playerRef.current;
    const dest = drop
      ? resolvePlayerDropDest(event.clientX, event.clientY, card?.id)
      : null;
    setDragPos(null);
    takeDraggingPlayer();
    clearDropHover();
    if (card && dest) {
      onDropRef.current?.(card, dest);
    }
  }

  return {
    dragPos,
    gripHandlers: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        const card = playerRef.current;
        if (!card || !isGripDragPointer(event) || event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        active.current = true;
        setDraggingPlayer(card);
        setDragPos({ x: event.clientX, y: event.clientY });
        setPlayerDropHover(resolvePlayerDropDest(event.clientX, event.clientY, card.id));
        document.body.style.overflow = "hidden";
        hapticTap();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is best-effort on older WebViews.
        }
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        if (!active.current) {
          return;
        }
        event.preventDefault();
        setDragPos({ x: event.clientX, y: event.clientY });
        setPlayerDropHover(
          resolvePlayerDropDest(event.clientX, event.clientY, playerRef.current?.id),
        );
      },
      onPointerUp(event: PointerEvent<HTMLButtonElement>) {
        endDrag(event, true);
      },
      onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
        endDrag(event, false);
      },
    },
  };
}
