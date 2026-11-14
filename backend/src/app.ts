import express from 'express';
import cors from 'cors';
import { env, getAllowedOrigins } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rankingRoutes } from './modules/rankings/ranking.routes';
import { playerRoutes } from './modules/players/player.routes';
import { matchRoutes } from './modules/matches/match.routes';
import { cronRoutes } from './modules/cron/cron.routes';
import path from 'path';

const app = express();

// Production-safe CORS configuration
const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server, cron)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');

      // Explicitly allowed origins
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments (e.g. https://tptennisscope-*-tuetd2150s-projects.vercel.app)
      if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(normalizedOrigin)) {
        return callback(null, true);
      }

      // Allow localhost on any port in development/test
      if (
        env.NODE_ENV !== 'production' &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin "${origin}" not allowed by policy.`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(requestLogger);

// Serve cached player images (local fallback; persistent storage on cloud requires object store)
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
app.use('/api/cron', cronRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
export { app };
