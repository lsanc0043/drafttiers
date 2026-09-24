import type { PlayerDropDest, TierDropDest } from "@/lib/board-drop-target";

type Listener = () => void;

let playerHover: PlayerDropDest | null = null;
let tierHover: (TierDropDest & { sourceId: string }) | null = null;
const playerListeners = new Set<Listener>();
const tierListeners = new Set<Listener>();

function emit(listeners: Set<Listener>) {
  for (const listener of listeners) {
    listener();
  }
}

export function setPlayerDropHover(dest: PlayerDropDest | null) {
  playerHover = dest;
  emit(playerListeners);
}

export function peekPlayerDropHover() {
  return playerHover;
}

export function subscribePlayerDropHover(listener: Listener) {
  playerListeners.add(listener);
  return () => {
    playerListeners.delete(listener);
  };
}

export function setTierDropHover(dest: (TierDropDest & { sourceId: string }) | null) {
  tierHover = dest;
  emit(tierListeners);
}

export function peekTierDropHover() {
  return tierHover;
}

export function subscribeTierDropHover(listener: Listener) {
  tierListeners.add(listener);
  return () => {
    tierListeners.delete(listener);
  };
}

export function clearDropHover() {
  setPlayerDropHover(null);
  setTierDropHover(null);
}
