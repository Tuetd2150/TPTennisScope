import { Router, Request, Response } from 'express';
import { cronAuth } from '../../middleware/cronAuth';
import { dbLockService } from '../sync/dbLock.service';

const router = Router();

// Apply auth & environment gates to all /api/cron/* routes
router.use(cronAuth);

/**
 * GET/POST /api/cron/ranking
 * Triggers daily ATP Top 100 ranking sync.
 * Protected by Postgres advisory lock (anti-overlap on serverless).
 */
const handleRankingCron = async (_req: Request, res: Response): Promise<void> => {
  console.log('[CronRoute] Initiating ranking sync cron job...');
  try {
    const lockResult = await dbLockService.withLock('tennisscope:cron:ranking', async () => {
      const { rankingSyncService } = await import('../sync/rankingSync.service');
      return rankingSyncService.sync();
    });

    if (!lockResult.executed) {
      res.status(200).json({
        status: 'skipped',
        reason: lockResult.reason,
        message: 'Ranking sync already running in another instance.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: lockResult.result,
    });
  } catch (error) {
    console.error('[CronRoute] Ranking sync cron failed:', error);
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
};

router.get('/ranking', handleRankingCron);
router.post('/ranking', handleRankingCron);

/**
 * GET/POST /api/cron/matches
 * Triggers incremental match sync (6-hour interval).
 * Protected by Postgres advisory lock.
 */
const handleMatchCron = async (_req: Request, res: Response): Promise<void> => {
  console.log('[CronRoute] Initiating match sync cron job...');
  try {
    const lockResult = await dbLockService.withLock('tennisscope:cron:matches', async () => {
      const { matchSyncService } = await import('../sync/matchSync.service');
      return matchSyncService.sync();
    });

    if (!lockResult.executed) {
      res.status(200).json({
        status: 'skipped',
        reason: lockResult.reason,
        message: 'Match sync already running in another instance.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: lockResult.result,
    });
  } catch (error) {
    console.error('[CronRoute] Match sync cron failed:', error);
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
};

router.get('/matches', handleMatchCron);
router.post('/matches', handleMatchCron);

/**
 * GET/POST /api/cron/profile-reconcile
 * Triggers pending player profile / birthday reconciliation.
 * Protected by Postgres advisory lock and strictly quota-aware.
 */
const handleProfileCron = async (_req: Request, res: Response): Promise<void> => {
  console.log('[CronRoute] Initiating profile reconciliation cron job...');
  try {
    const lockResult = await dbLockService.withLock('tennisscope:cron:profile', async () => {
      const { profileSyncService } = await import('../sync/profileSync.service');
      return profileSyncService.processPendingProfiles();
    });

    if (!lockResult.executed) {
      res.status(200).json({
        status: 'skipped',
        reason: lockResult.reason,
        message: 'Profile reconciliation already running in another instance.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: lockResult.result,
    });
  } catch (error) {
    console.error('[CronRoute] Profile reconciliation cron failed:', error);
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
};

router.get('/profile-reconcile', handleProfileCron);
router.post('/profile-reconcile', handleProfileCron);

export { router as cronRoutes };
