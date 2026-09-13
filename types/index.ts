export type BoardSummary = {
  id: string;
  name: string;
};

export type PlayerSummary = {
  id: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
};
