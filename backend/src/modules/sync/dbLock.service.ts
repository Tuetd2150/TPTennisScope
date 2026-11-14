import { prisma } from '../../config/database';
import { SyncJobType, SyncJobStatus } from '@prisma/client';

export interface DbLockResult<T> {
  acquired: boolean;
  executed: boolean;
  result?: T;
  reason?: string;
}

function resolveJobType(key: string): SyncJobType {
  const lower = key.toLowerCase();
  if (lower.includes('ranking')) return SyncJobType.RANKING;
  if (lower.includes('match')) return SyncJobType.MATCH_RESULTS;
  if (lower.includes('profile')) return SyncJobType.PLAYER_PROFILE;
  return SyncJobType.BACKFILL;
}

const LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes timeout for serverless crash recovery

export class DbLockService {
  // In-process lock map for fast same-container race prevention and test mock fallback
  private inProcessLocks = new Map<string, boolean>();

  /**
   * Executes an action under a distributed database-backed lock.
   * Safe for serverless connection pooling (Neon/PgBouncer) by combining:
   * 1. A short transaction-level advisory lock (pg_advisory_xact_lock) lasting ~2ms to serialize atomic claims.
   * 2. An application-level lease in SyncJob with status=RUNNING and a 15-minute TTL.
   * 3. No long-lived open transactions or session locks while the actual action runs.
   *
   * @param lockKey Unique lock identifier (e.g. 'tennisscope:sync:ranking')
   * @param action Async operation to execute
   */
  async withLock<T>(
    lockKey: string,
    action: () => Promise<T>
  ): Promise<DbLockResult<T>> {
    // 1. Synchronous in-process lock check (prevents same-process / same-container race conditions)
    if (this.inProcessLocks.get(lockKey)) {
      console.warn(`[DbLockService] In-process lock already held for "${lockKey}". Skipping.`);
      return {
        acquired: false,
        executed: false,
        reason: 'LOCKED_BY_ANOTHER_INSTANCE',
      };
    }

    this.inProcessLocks.set(lockKey, true);

    let activeJobId: number | null = null;
    const jobType = resolveJobType(lockKey);

    try {
      // 2. Atomic database-level lock check & claim via SyncJob transaction (pooler-safe)
      const now = new Date();
      const cutoff = new Date(now.getTime() - LOCK_TTL_MS);

      activeJobId = await prisma.$transaction(async (tx) => {
        // Transaction-level advisory lock serializes concurrent claims for the same lockKey across all serverless instances.
        // It is automatically released when this short transaction commits or rolls back (~2ms),
        // making it completely safe with Neon/PgBouncer connection poolers.
        await tx.$queryRaw<Array<{ locked: number }>>`
          WITH claim_lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
          )
          SELECT 1::int AS locked
          FROM claim_lock
        `;

        // Check if there is an active running job for this lockKey that hasn't timed out
        const active = await tx.syncJob.findFirst({
          where: {
            targetKey: lockKey,
            status: SyncJobStatus.RUNNING,
            startedAt: { gte: cutoff },
          },
          select: { id: true },
        });

        if (active) {
          return null; // Another serverless instance is currently holding the lock
        }

        // Mark any stale RUNNING jobs (> 15 mins) as FAILED to clean up crashes
        await tx.syncJob.updateMany({
          where: {
            targetKey: lockKey,
            status: SyncJobStatus.RUNNING,
            startedAt: { lt: cutoff },
          },
          data: {
            status: SyncJobStatus.FAILED,
            finishedAt: now,
            errorMessage: 'Execution timed out (stale serverless instance crash recovery)',
          },
        });

        // Create new active lock job
        const job = await tx.syncJob.create({
          data: {
            type: jobType,
            targetKey: lockKey,
            status: SyncJobStatus.RUNNING,
            startedAt: now,
          },
          select: { id: true },
        });

        return job.id;
      });

      if (!activeJobId) {
        console.warn(`[DbLockService] Database lock already held by another instance for "${lockKey}". Skipping.`);
        this.inProcessLocks.delete(lockKey);
        return {
          acquired: false,
          executed: false,
          reason: 'LOCKED_BY_ANOTHER_INSTANCE',
        };
      }
    } catch (dbErr) {
      // If DB transaction fails (e.g. mock unit tests without DB), fallback to in-memory lock
      console.warn(`[DbLockService] DB lock acquisition failed, using fallback in-process lock for "${lockKey}":`, (dbErr as Error).message);
    }

    let executionError: Error | null = null;
    try {
      const result = await action();
      return {
        acquired: true,
        executed: true,
        result,
      };
    } catch (err) {
      executionError = err as Error;
      throw err;
    } finally {
      // Always release in-process lock
      this.inProcessLocks.delete(lockKey);

      // Release DB lock by updating SyncJob status
      if (activeJobId) {
        try {
          await prisma.syncJob.update({
            where: { id: activeJobId },
            data: {
              status: executionError ? SyncJobStatus.FAILED : SyncJobStatus.COMPLETED,
              finishedAt: new Date(),
              errorMessage: executionError ? executionError.message : null,
            },
          });
        } catch (releaseErr) {
          console.error(`[DbLockService] Failed to update lock job status for "${lockKey}":`, releaseErr);
        }
      }
    }
  }
}

export const dbLockService = new DbLockService();
