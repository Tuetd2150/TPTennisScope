import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env';

let matchSyncTask: ScheduledTask | null = null;
let rankingSyncTask: ScheduledTask | null = null;
let profileSyncTask: ScheduledTask | null = null;

let isMatchSyncRunning = false;
let isRankingSyncRunning = false;
let isProfileSyncRunning = false;

export const SCHEDULER_CRON_EXPRESSIONS = {
  MATCH_SYNC: '0 0,6,12,18 * * *',
  RANKING_SYNC: '0 3 * * *',
  PROFILE_SYNC: '0 4 * * *',
} as const;

export function initScheduler(): {
  matchTask: ScheduledTask;
  rankingTask: ScheduledTask;
  profileTask: ScheduledTask;
} {
  // Prevent duplicate registration if called multiple times
  stopScheduler();

  console.log(`📅 Initializing scheduler (timezone: ${env.SYNC_TIMEZONE})`);

  // Match sync every 6 hours: 0:00, 6:00, 12:00, 18:00
  matchSyncTask = cron.schedule(
    SCHEDULER_CRON_EXPRESSIONS.MATCH_SYNC,
    async () => {
      if (isMatchSyncRunning) {
        console.warn('[Scheduler] Previous match sync still in progress, skipping overlap run');
        return;
      }
      isMatchSyncRunning = true;
      console.log('[Scheduler] Running match sync...');
      try {
        const { matchSyncService } = await import('../modules/sync/matchSync.service');
        await matchSyncService.sync();
      } catch (error) {
        console.error('[Scheduler] Match sync failed:', error);
      } finally {
        isMatchSyncRunning = false;
      }
    },
    { timezone: env.SYNC_TIMEZONE }
  );

  // Ranking sync daily at 3:00
  rankingSyncTask = cron.schedule(
    SCHEDULER_CRON_EXPRESSIONS.RANKING_SYNC,
    async () => {
      if (isRankingSyncRunning) {
        console.warn('[Scheduler] Previous ranking sync still in progress, skipping overlap run');
        return;
      }
      isRankingSyncRunning = true;
      console.log('[Scheduler] Running ranking sync...');
      try {
        const { rankingSyncService } = await import('../modules/sync/rankingSync.service');
        await rankingSyncService.sync();
      } catch (error) {
        console.error('[Scheduler] Ranking sync failed:', error);
      } finally {
        isRankingSyncRunning = false;
      }
    },
    { timezone: env.SYNC_TIMEZONE }
  );

  // Profile sync daily at 4:00 (process pending profile jobs)
  profileSyncTask = cron.schedule(
    SCHEDULER_CRON_EXPRESSIONS.PROFILE_SYNC,
    async () => {
      if (isProfileSyncRunning) {
        console.warn('[Scheduler] Previous profile sync still in progress, skipping overlap run');
        return;
      }
      isProfileSyncRunning = true;
      console.log('[Scheduler] Running profile sync...');
      try {
        const { profileSyncService } = await import('../modules/sync/profileSync.service');
        await profileSyncService.processPendingProfiles();
      } catch (error) {
        console.error('[Scheduler] Profile sync failed:', error);
      } finally {
        isProfileSyncRunning = false;
      }
    },
    { timezone: env.SYNC_TIMEZONE }
  );

  console.log('✅ Scheduler initialized');
  return {
    matchTask: matchSyncTask,
    rankingTask: rankingSyncTask,
    profileTask: profileSyncTask,
  };
}

export function stopScheduler(): void {
  if (matchSyncTask) {
    matchSyncTask.stop();
    matchSyncTask = null;
  }
  if (rankingSyncTask) {
    rankingSyncTask.stop();
    rankingSyncTask = null;
  }
  if (profileSyncTask) {
    profileSyncTask.stop();
    profileSyncTask = null;
  }
}

export function getSchedulerState() {
  return {
    isInitialized: !!(matchSyncTask && rankingSyncTask && profileSyncTask),
    timezone: env.SYNC_TIMEZONE,
    expressions: SCHEDULER_CRON_EXPRESSIONS,
    locks: {
      isMatchSyncRunning,
      isRankingSyncRunning,
      isProfileSyncRunning,
    },
  };
}
