import { Request, Response, NextFunction } from 'express';
import { matchService } from './match.service';
import { z } from 'zod';

const matchIdSchema = z.coerce.number().int().positive();

export const matchController = {
  getMatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = matchIdSchema.parse(req.params.id);
      const match = await matchService.getMatchDetails(id);
      res.json(match);
    } catch (err) {
      next(err);
    }
  }
};
