import cron from 'node-cron';
import { env } from '../config/env';

export function initScheduler(): void {
  console.log(`📅 Initializing scheduler (timezone: ${env.SYNC_TIMEZONE})`);

  // Match sync every 6 hours: 0:00, 6:00, 12:00, 18:00
  cron.schedule('0 0,6,12,18 * * *', async () => {
    console.log('[Scheduler] Running match sync...');
    try {
      const { matchSyncService } = await import('../modules/sync/matchSync.service');
      await matchSyncService.sync();
    } catch (error) {
      console.error('[Scheduler] Match sync failed:', error);
    }
  }, { timezone: env.SYNC_TIMEZONE });

  // Ranking sync daily at 3:00
  cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Running ranking sync...');
    try {
      const { rankingSyncService } = await import('../modules/sync/rankingSync.service');
      await rankingSyncService.sync();
    } catch (error) {
      console.error('[Scheduler] Ranking sync failed:', error);
    }
  }, { timezone: env.SYNC_TIMEZONE });

  // Profile sync daily at 4:00 (process pending profile jobs)
  cron.schedule('0 4 * * *', async () => {
    console.log('[Scheduler] Running profile sync...');
    try {
      const { profileSyncService } = await import('../modules/sync/profileSync.service');
      await profileSyncService.processPendingProfiles();
    } catch (error) {
      console.error('[Scheduler] Profile sync failed:', error);
    }
  }, { timezone: env.SYNC_TIMEZONE });

  console.log('✅ Scheduler initialized');
}
