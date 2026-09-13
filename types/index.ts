export type BoardSummary = {
  id: string;
  name: string;
};

export type PlayerSummary = {
  id: string;
  nbaPersonId: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  isActive: boolean;
  isRookie?: boolean;
};
