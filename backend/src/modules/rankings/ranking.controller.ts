import { Request, Response, NextFunction } from 'express';
import { rankingService } from './ranking.service';
import { z } from 'zod';

const limitSchema = z.coerce.number().int().positive().default(100);
const playerIdSchema = z.coerce.number().int().positive();

export const rankingController = {
  getRankings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = limitSchema.parse(req.query.limit);
      const rankings = await rankingService.getRankings(limit);
      res.json(rankings);
    } catch (err) {
      next(err);
    }
  },

  getHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = playerIdSchema.parse(req.params.playerId);
      const history = await rankingService.getPlayerRankingHistory(playerId);
      res.json(history);
    } catch (err) {
      next(err);
    }
  }
};
