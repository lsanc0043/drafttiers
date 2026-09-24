import type { DraftSettingsInput } from "@/lib/validation";

export type DraftSettings = DraftSettingsInput;

export type BoardSummary = {
  id: string;
  name: string;
  visibility: "PRIVATE" | "SHARED";
  updatedAt: string;
  bucketCount: number;
  hasDraftSettings: boolean;
};

export type BoardBucketPlayer = {
  assignmentId: string;
  playerId: string;
  nbaPersonId: number;
  fullName: string;
  teamAbbr: string | null;
  teamName: string | null;
  position: string | null;
  jerseyNumber: string | null;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
};

export type BoardBucket = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  players: BoardBucketPlayer[];
};

export type BoardDetail = {
  id: string;
  name: string;
  visibility: "PRIVATE" | "SHARED";
  createdAt: string;
  updatedAt: string;
  sleeperDraftId: string | null;
  draftSettings: DraftSettings | null;
  buckets: BoardBucket[];
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
