import { Request, Response, NextFunction } from 'express';
import { playerService } from './player.service';
import { playerComparisonQuerySchema, playerIdSchema, playerSeasonQuerySchema } from './player.schema';

export const playerController = {
  getProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = playerIdSchema.parse(req.params.id);
      const profile = await playerService.getPlayerProfile(id);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },

  getStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = playerIdSchema.parse(req.params.id);
      const { season } = playerSeasonQuerySchema.parse(req.query);
      const stats = await playerService.getPlayerSeasonStats(id, season);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },

  getMatches: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = playerIdSchema.parse(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const matches = await playerService.getPlayerMatches(id, limit);
      res.json(matches);
    } catch (err) {
      next(err);
    }
  },

  comparePlayers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { player1, player2 } = playerComparisonQuerySchema.parse(req.query);
      const comparison = await playerService.comparePlayers(player1, player2);
      res.json(comparison);
    } catch (err) {
      next(err);
    }
  },
  
  getTitles: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = playerIdSchema.parse(req.params.id);
      const profile = await playerService.getPlayerProfile(id);
      res.json(profile.titles);
    } catch (err) {
      next(err);
    }
  }
};
