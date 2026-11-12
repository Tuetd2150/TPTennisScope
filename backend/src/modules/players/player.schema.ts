import { z } from 'zod';

export const playerIdSchema = z.coerce.number().int().positive();

export const playerComparisonQuerySchema = z.object({
  player1: z.coerce.number().int().positive(),
  player2: z.coerce.number().int().positive(),
});

export const playerSeasonQuerySchema = z.object({
  season: z.coerce.number().int().positive().default(new Date().getFullYear()),
});
