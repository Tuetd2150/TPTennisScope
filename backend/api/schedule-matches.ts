import { handleSchedule } from '@vercel/schedules';
import { env } from '../src/config/env';
import { dbLockService } from '../src/modules/sync/dbLock.service';

/**
 * Core business execution for scheduled incremental match sync.
 * Exported separately to allow direct testing without requiring CloudEvent signature headers.
 */
export async function runScheduledMatches(): Promise<{
  executed: boolean;
  reason?: string;
  data?: unknown;
}> {
  // 1. Preview Deployment Gate: Do not consume provider quota in non-production environments
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    console.log(
      `[ScheduleMatches] Skipping match sync in non-production Vercel environment: ${env.VERCEL_ENV}`
    );
    return {
      executed: false,
      reason: 'PREVIEW_ENVIRONMENT',
    };
  }

  // 2. Production Cron/Schedule Gate: Must be explicitly enabled
  if (!env.ENABLE_PRODUCTION_CRON) {
    console.log(
      '[ScheduleMatches] Production schedule is DISABLED (ENABLE_PRODUCTION_CRON=false). Skipping execution safely.'
    );
    return {
      executed: false,
      reason: 'PRODUCTION_CRON_DISABLED',
    };
  }

  // 3. Distributed anti-overlap lock & sync execution
  console.log('[ScheduleMatches] Initiating match sync under database lock...');
  const lockResult = await dbLockService.withLock(
    'tennisscope:sync:matches',
    async () => {
      const { matchSyncService } = await import(
        '../src/modules/sync/matchSync.service'
      );
      return matchSyncService.sync();
    }
  );

  if (!lockResult.executed) {
    console.warn(`[ScheduleMatches] Skipped match sync: ${lockResult.reason}`);
    return {
      executed: false,
      reason: lockResult.reason,
    };
  }

  console.log('[ScheduleMatches] Match sync completed successfully.');
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
    `[ScheduleMatches] Triggered schedule "${metadata.name}" scheduled for ${metadata.scheduledAt.toISOString()}`
  );
  await runScheduledMatches();
});

