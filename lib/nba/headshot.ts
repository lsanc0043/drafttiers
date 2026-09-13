export function nbaHeadshotUrl(nbaPersonId: number, size: "small" | "large" = "small") {
  const dimensions = size === "large" ? "1040x760" : "260x190";
  return `https://cdn.nba.com/headshots/nba/latest/${dimensions}/${nbaPersonId}.png`;
}

export function playerInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
