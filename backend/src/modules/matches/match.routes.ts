import { Router } from 'express';
import { matchController } from './match.controller';

export const matchRoutes = Router();

matchRoutes.get('/matches/:id', matchController.getMatch);
