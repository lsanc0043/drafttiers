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
});

export type NbaPlayerInput = z.infer<typeof nbaPlayerSchema>;
export type PlayerListQuery = z.infer<typeof playerListQuerySchema>;
