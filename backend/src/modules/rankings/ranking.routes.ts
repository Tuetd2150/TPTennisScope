import { Router } from 'express';
import { rankingController } from './ranking.controller';

export const rankingRoutes = Router();

rankingRoutes.get('/rankings', rankingController.getRankings);
rankingRoutes.get('/rankings/history/:playerId', rankingController.getHistory);
