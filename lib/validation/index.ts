import { z } from "zod";

export const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  visibility: z.enum(["PRIVATE", "SHARED"]).default("PRIVATE"),
});

export const updateBoardSchema = createBoardSchema.partial();

export const createBucketSchema = z.object({
  boardId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).optional(),
});

export const playerSearchSchema = z.object({
  query: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(50).default(20),
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

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type CreateBucketInput = z.infer<typeof createBucketSchema>;
export type PlayerSearchInput = z.infer<typeof playerSearchSchema>;
export type BoardPlayerMoveInput = z.infer<typeof boardPlayerMoveSchema>;
