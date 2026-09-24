export const NBA_TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "LA Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

export function nbaTeamName(teamAbbr: string | null | undefined) {
  if (!teamAbbr) {
    return null;
  }
  return NBA_TEAM_NAMES[teamAbbr.toUpperCase()] ?? null;
}

export type TeamColor = {
  color: string;
};

export const NBA_TEAM_COLORS: Record<string, TeamColor> = {
  ATL: { color: "#C8102E" },
  BOS: { color: "#007A33" },
  BKN: { color: "#000000" },
  CHA: { color: "#1D1160" },
  CHI: { color: "#CE1141" },
  CLE: { color: "#860038" },
  DAL: { color: "#00538C" },
  DEN: { color: "#0E2240" },
  DET: { color: "#C8102E" },
  GSW: { color: "#1D428A" },
  HOU: { color: "#CE1141" },
  IND: { color: "#002D62" },
  LAC: { color: "#C8102E" },
  LAL: { color: "#552583" },
  MEM: { color: "#5D76A9" },
  MIA: { color: "#98002E" },
  MIL: { color: "#00471B" },
  MIN: { color: "#0C2340" },
  NOP: { color: "#C8102E" },
  NYK: { color: "#006BB6" },
  OKC: { color: "#007AC1" },
  ORL: { color: "#0077C0" },
  PHI: { color: "#006BB6" },
  PHX: { color: "#E56020" },
  POR: { color: "#E03A3E" },
  SAC: { color: "#5A2D81" },
  SAS: { color: "#C4CED4" },
  TOR: { color: "#CE1141" },
  UTA: { color: "#002B5C" },
  WAS: { color: "#002B5C" },
};

function hexLuminance(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) {
    return 0;
  }
  const channel = (start: number) => {
    const srgb = Number.parseInt(value.slice(start, start + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

export function teamTagStyle(teamAbbr: string | null | undefined): {
  color: string;
  borderColor: string;
  backgroundColor: string;
} | undefined {
  if (!teamAbbr) {
    return undefined;
  }
  const color = NBA_TEAM_COLORS[teamAbbr.toUpperCase()]?.color;
  if (!color) {
    return undefined;
  }
  const luminance = hexLuminance(color);
  const onDark = luminance < 0.45;
  return {
    color: onDark ? "#F4F4F5" : "#18181B",
    borderColor: onDark ? "color-mix(in srgb, #F4F4F5 35%, transparent)" : color,
    backgroundColor: color,
  };
}
