import { handleSchedule } from '@vercel/schedules';
import { env } from '../src/config/env';
import { dbLockService } from '../src/modules/sync/dbLock.service';

/**
 * Core business execution for scheduled player profile & birthday reconciliation.
 * Exported separately to allow direct testing without requiring CloudEvent signature headers.
 */
export async function runScheduledProfileReconcile(): Promise<{
  executed: boolean;
  reason?: string;
  data?: unknown;
}> {
  // 1. Preview Deployment Gate: Do not consume provider quota in non-production environments
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    console.log(
      `[ScheduleProfileReconcile] Skipping profile reconciliation in non-production Vercel environment: ${env.VERCEL_ENV}`
    );
    return {
      executed: false,
      reason: 'PREVIEW_ENVIRONMENT',
    };
  }

  // 2. Production Cron/Schedule Gate: Must be explicitly enabled
  if (!env.ENABLE_PRODUCTION_CRON) {
    console.log(
      '[ScheduleProfileReconcile] Production schedule is DISABLED (ENABLE_PRODUCTION_CRON=false). Skipping execution safely.'
    );
    return {
      executed: false,
      reason: 'PRODUCTION_CRON_DISABLED',
    };
  }

  // 3. Distributed anti-overlap lock & sync execution
  console.log('[ScheduleProfileReconcile] Initiating profile reconciliation under database lock...');
  const lockResult = await dbLockService.withLock(
    'tennisscope:sync:profile',
    async () => {
      const { profileSyncService } = await import(
        '../src/modules/sync/profileSync.service'
      );
      return profileSyncService.processPendingProfiles();
    }
  );

  if (!lockResult.executed) {
    console.warn(
      `[ScheduleProfileReconcile] Skipped profile reconciliation: ${lockResult.reason}`
    );
    return {
      executed: false,
      reason: lockResult.reason,
    };
  }

  console.log('[ScheduleProfileReconcile] Profile reconciliation completed successfully.');
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
    `[ScheduleProfileReconcile] Triggered schedule "${metadata.name}" scheduled for ${metadata.scheduledAt.toISOString()}`
  );
  await runScheduledProfileReconcile();
});

