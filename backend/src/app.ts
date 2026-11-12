import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rankingRoutes } from './modules/rankings/ranking.routes';
import { playerRoutes } from './modules/players/player.routes';
import { matchRoutes } from './modules/matches/match.routes';
import path from 'path';

const app = express();

// Middleware
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json());
app.use(requestLogger);

// Serve cached player images
app.use('/api/images/players', express.static(path.join(__dirname, '..', 'storage', 'player-images')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Routes
app.use('/api', rankingRoutes);
app.use('/api', playerRoutes);
app.use('/api', matchRoutes);

// Error handler (must be last)
app.use(errorHandler);

export { app };
