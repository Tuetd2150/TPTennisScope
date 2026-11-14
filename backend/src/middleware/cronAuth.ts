import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Verify CRON_SECRET is configured
  const configuredSecret = env.CRON_SECRET;
  if (!configuredSecret) {
    if (env.NODE_ENV === 'production') {
      console.error('[CronAuth] CRON_SECRET is not configured in production environment.');
      res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET is required.' });
      return;
    }
  }

  // 2. Validate Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized: Missing Authorization header.' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(401).json({ error: 'Unauthorized: Invalid Authorization header format. Expected Bearer token.' });
    return;
  }

  const token = parts[1];
  if (token !== configuredSecret) {
    res.status(401).json({ error: 'Unauthorized: Invalid cron secret.' });
    return;
  }

  // 3. Preview Deployment Gate: Do not consume provider quota in non-production environments
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    console.log(`[CronAuth] Skipping cron job in non-production Vercel environment: ${env.VERCEL_ENV}`);
    res.status(200).json({
      status: 'skipped',
      reason: 'PREVIEW_ENVIRONMENT',
      message: `Cron execution skipped in non-production environment (${env.VERCEL_ENV}).`,
    });
    return;
  }

  // 4. Production Cron Gate: Must be explicitly enabled
  if (!env.ENABLE_PRODUCTION_CRON) {
    console.log('[CronAuth] Skipping cron job because ENABLE_PRODUCTION_CRON is false.');
    res.status(200).json({
      status: 'skipped',
      reason: 'PRODUCTION_CRON_DISABLED',
      message: 'Production cron is disabled (ENABLE_PRODUCTION_CRON=false). Enable after DB migration & verification.',
    });
    return;
  }

  next();
}
