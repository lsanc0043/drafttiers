import { z } from "zod";

export const nbaPlayerSchema = z.object({
  nbaPersonId: z.number().int().positive(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  fullName: z.string().trim().min(1).max(160),
  teamId: z.number().int().positive().nullable(),
  teamAbbr: z.string().trim().min(1).max(10).nullable(),
  teamName: z.string().trim().min(1).max(80).nullable(),
  position: z.string().trim().min(1).max(20).nullable(),
  jerseyNumber: z.string().trim().min(1).max(10).nullable().optional(),
  fromYear: z.number().int().min(1946).max(2100).nullable().optional().default(null),
  isActive: z.boolean(),
});

export const nbaCatalogSchema = z.object({
  source: z.string().optional(),
  fetched: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().optional().default(0),
  indexError: z.string().nullable().optional(),
  players: z.array(z.unknown()),
});

export const playerListQuerySchema = z.object({
  query: z.string().trim().max(80).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  active: z.enum(["true", "false", "all"]).optional().default("true"),
  team: z.string().trim().max(40).optional(),
  sort: z.enum(["name", "fantasy"]).optional().default("name"),
  scoring: z.string().max(4000).optional(),
});

export type NbaPlayerInput = z.infer<typeof nbaPlayerSchema>;
export type PlayerListQuery = z.infer<typeof playerListQuerySchema>;

export const nbaSeasonStatSchema = z.object({
  nbaPersonId: z.number().int().positive(),
  season: z.string().min(4).max(16),
  gamesPlayed: z.number().int().nonnegative(),
  minutes: z.number().nonnegative(),
  points: z.number().nonnegative(),
  rebounds: z.number().nonnegative(),
  assists: z.number().nonnegative(),
  steals: z.number().nonnegative(),
  blocks: z.number().nonnegative(),
  turnovers: z.number().nonnegative(),
  fieldGoalsMade: z.number().nonnegative(),
  fieldGoalsAttempted: z.number().nonnegative(),
  threePointersMade: z.number().nonnegative(),
  threePointersAttempted: z.number().nonnegative(),
  freeThrowsMade: z.number().nonnegative(),
  freeThrowsAttempted: z.number().nonnegative(),
});

export const nbaGameLogSchema = z.object({
  nbaPersonId: z.number().int().positive(),
  gameId: z.string().trim().min(1).max(32),
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().nonnegative(),
  points: z.number().int().nonnegative(),
  rebounds: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  steals: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  turnovers: z.number().int().nonnegative(),
  fieldGoalsMade: z.number().int().nonnegative(),
  fieldGoalsAttempted: z.number().int().nonnegative(),
  threePointersMade: z.number().int().nonnegative(),
  threePointersAttempted: z.number().int().nonnegative(),
  freeThrowsMade: z.number().int().nonnegative(),
  freeThrowsAttempted: z.number().int().nonnegative(),
});

export const nbaStatsBundleSchema = z.object({
  source: z.string().optional(),
  season: z.string().optional(),
  seasons: z.array(z.string()).optional(),
  seasonStats: z.array(z.unknown()),
  gameLogs: z.array(z.unknown()),
  errors: z.array(z.string()).optional().default([]),
});

export type NbaSeasonStatInput = z.infer<typeof nbaSeasonStatSchema>;
export type NbaGameLogInput = z.infer<typeof nbaGameLogSchema>;
