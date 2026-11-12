import { Router } from 'express';
import { playerController } from './player.controller';

export const playerRoutes = Router();

playerRoutes.get('/players/compare', playerController.comparePlayers);
playerRoutes.get('/players/:id', playerController.getProfile);
playerRoutes.get('/players/:id/stats', playerController.getStats);
playerRoutes.get('/players/:id/matches', playerController.getMatches);
playerRoutes.get('/players/:id/titles', playerController.getTitles);
