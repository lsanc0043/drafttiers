import {
  type RosterSlotKey,
} from "@/lib/sleeper/roster/types";

const POSITION_ALIASES: Record<string, RosterSlotKey[]> = {
  PG: ["PG"],
  POINT: ["PG"],
  POINTGUARD: ["PG"],
  SG: ["SG"],
  SHOOTING: ["SG"],
  SHOOTINGGUARD: ["SG"],
  SF: ["SF"],
  SMALL: ["SF"],
  SMALLFORWARD: ["SF"],
  PF: ["PF"],
  POWER: ["PF"],
  POWERFORWARD: ["PF"],
  C: ["C"],
  CENTER: ["C"],
  G: ["G"],
  GUARD: ["G"],
  F: ["F"],
  FORWARD: ["F"],
};

export const FANTASY_POSITION_ORDER = ["PG", "SG", "SF", "PF", "C"] as const;

export function sleeperPositionLabel(value: string | string[] | null | undefined): string {
  const parts = (Array.isArray(value) ? value : [value ?? ""])
    .flatMap((part) => String(part).split(/[/|,]/u))
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.sort((left, right) => {
    const leftIndex = (FANTASY_POSITION_ORDER as readonly string[]).indexOf(left);
    const rightIndex = (FANTASY_POSITION_ORDER as readonly string[]).indexOf(right);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.localeCompare(right);
  }).join("/");
}

export function parseNbaPositions(value: string | string[] | null | undefined): RosterSlotKey[] {
  const chunks = (Array.isArray(value) ? value : [value ?? ""])
    .flatMap((part) => String(part).split(/[\s,/|-]+/u))
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);

  const positions = new Set<RosterSlotKey>();
  for (const chunk of chunks) {
    const mapped = POSITION_ALIASES[chunk];
    if (mapped) {
      for (const position of mapped) {
        positions.add(position);
      }
    }
  }
  return [...positions];
}

export function getPlayerEligibleSlots(
  positions: string | string[] | null | undefined,
): RosterSlotKey[] {
  const parsed = parseNbaPositions(positions);
  const eligible = new Set<RosterSlotKey>(["UTIL"]);

  for (const position of parsed) {
    if (position === "PG") {
      eligible.add("PG");
      eligible.add("G");
    }
    if (position === "SG") {
      eligible.add("SG");
      eligible.add("G");
    }
    if (position === "G") {
      eligible.add("PG");
      eligible.add("SG");
      eligible.add("G");
    }
    if (position === "SF") {
      eligible.add("SF");
      eligible.add("F");
    }
    if (position === "PF") {
      eligible.add("PF");
      eligible.add("F");
    }
    if (position === "F") {
      eligible.add("SF");
      eligible.add("PF");
      eligible.add("F");
    }
    if (position === "C") {
      eligible.add("C");
    }
  }

  return [...eligible];
}
