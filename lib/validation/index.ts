import { z } from "zod";
import type { FantasyScoring } from "@/lib/nba/fantasy";

const scoringNumber = z.number({ invalid_type_error: "Required" }).finite();

export const fantasyScoringSchema = z.object({
  points: scoringNumber,
  rebounds: scoringNumber,
  assists: scoringNumber,
  blocks: scoringNumber,
  steals: scoringNumber,
  doubleDouble: scoringNumber,
  turnover: scoringNumber,
  threePointer: scoringNumber,
  tripleDouble: scoringNumber,
  technical: scoringNumber,
  flagrant: scoringNumber,
  points40: scoringNumber,
  points50: scoringNumber,
}) satisfies z.ZodType<FantasyScoring>;

export const draftTypeSchema = z.enum(["SNAKE", "LINEAR", "CUSTOM"]);

export const draftSettingsSchema = z
  .object({
    teamCount: z.number().int().min(2).max(30),
    draftPosition: z.number().int().min(1).max(30),
    roundCount: z.number().int().min(1).max(30),
    draftType: draftTypeSchema,
    roundTimerSeconds: z.number().int().min(1).max(3600),
    fantasyScoring: fantasyScoringSchema,
  })
  .refine((value) => value.draftPosition <= value.teamCount, {
    message: "Draft position cannot be greater than the number of teams",
    path: ["draftPosition"],
  });

export const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  visibility: z.enum(["PRIVATE", "SHARED"]).default("PRIVATE"),
  draftSettings: draftSettingsSchema.nullable().optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  visibility: z.enum(["PRIVATE", "SHARED"]).optional(),
  draftSettings: draftSettingsSchema.nullable().optional(),
});

export const bucketColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value like #ff7f7f");

export const DEFAULT_TIER_COLOR = "#594D5B";
export const TIER_COLOR_GRAY = "#808080";
export const TIER_COLOR_GRAPHITE = "#594D5B";

export function nextAlternatingTierColor(existingCount: number) {
  return existingCount % 2 === 0 ? TIER_COLOR_GRAY : TIER_COLOR_GRAPHITE;
}

export const createBucketSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: bucketColorSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const updateBucketSchema = createBucketSchema.partial();

export const playerSearchSchema = z.object({
  query: z.string().trim().max(80).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const assignBoardPlayerSchema = z.object({
  playerId: z.string().min(1),
  bucketId: z.string().min(1),
  beforePlayerId: z.string().min(1).optional(),
});

export const boardPlayerMoveSchema = z.object({
  boardPlayerId: z.string().min(1),
  bucketId: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const sleeperDraftLinkSchema = z.object({
  boardId: z.string().min(1),
  sleeperDraftId: z.string().min(1),
});

export const bulkBoardPlayersSchema = z
  .object({
    action: z.enum(["move", "unassign"]),
    playerIds: z.array(z.string().min(1)).min(1).max(200),
    bucketId: z.string().min(1).optional(),
  })
  .refine((value) => value.action !== "move" || Boolean(value.bucketId), {
    message: "bucketId is required when moving players",
    path: ["bucketId"],
  });

export type DraftSettingsInput = z.infer<typeof draftSettingsSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateBucketInput = z.infer<typeof createBucketSchema>;
export type UpdateBucketInput = z.infer<typeof updateBucketSchema>;
export type PlayerSearchInput = z.infer<typeof playerSearchSchema>;
export type AssignBoardPlayerInput = z.infer<typeof assignBoardPlayerSchema>;
export type BulkBoardPlayersInput = z.infer<typeof bulkBoardPlayersSchema>;
export type BoardPlayerMoveInput = z.infer<typeof boardPlayerMoveSchema>;
