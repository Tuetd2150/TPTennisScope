import { handleSchedule } from '@vercel/schedules';
import { env } from '../src/config/env';
import { dbLockService } from '../src/modules/sync/dbLock.service';

/**
 * Core business execution for scheduled ranking sync.
 * Exported separately to allow direct testing without requiring CloudEvent signature headers.
 */
export async function runScheduledRanking(): Promise<{
  executed: boolean;
  reason?: string;
  data?: unknown;
}> {
  // 1. Preview Deployment Gate: Do not consume provider quota in non-production environments
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    console.log(
      `[ScheduleRanking] Skipping ranking sync in non-production Vercel environment: ${env.VERCEL_ENV}`
    );
    return {
      executed: false,
      reason: 'PREVIEW_ENVIRONMENT',
    };
  }

  // 2. Production Cron/Schedule Gate: Must be explicitly enabled
  if (!env.ENABLE_PRODUCTION_CRON) {
    console.log(
      '[ScheduleRanking] Production schedule is DISABLED (ENABLE_PRODUCTION_CRON=false). Skipping execution safely.'
    );
    return {
      executed: false,
      reason: 'PRODUCTION_CRON_DISABLED',
    };
  }

  // 3. Distributed anti-overlap lock & sync execution
  console.log('[ScheduleRanking] Initiating ranking sync under database lock...');
  const lockResult = await dbLockService.withLock(
    'tennisscope:sync:ranking',
    async () => {
      const { rankingSyncService } = await import(
        '../src/modules/sync/rankingSync.service'
      );
      return rankingSyncService.sync();
    }
  );

  if (!lockResult.executed) {
    console.warn(`[ScheduleRanking] Skipped ranking sync: ${lockResult.reason}`);
    return {
      executed: false,
      reason: lockResult.reason,
    };
  }

  console.log('[ScheduleRanking] Ranking sync completed successfully.');
  return {
    executed: true,
    data: lockResult.result,
  };
}

/**
 * Private Vercel Schedule function handler.
 * Triggered exclusively by Vercel's internal schedule infrastructure via schedule/v1beta.
 */
export const POST = handleSchedule(async (metadata) => {
  console.log(
    `[ScheduleRanking] Triggered schedule "${metadata.name}" scheduled for ${metadata.scheduledAt.toISOString()}`
  );
  await runScheduledRanking();
});

export default POST;
