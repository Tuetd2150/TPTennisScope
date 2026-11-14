import { prisma } from '../../config/database';

export interface DbLockResult<T> {
  acquired: boolean;
  executed: boolean;
  result?: T;
  reason?: string;
}

// In-memory fallback map for non-Postgres test environments or mock setups
const inMemoryLocks = new Map<string, boolean>();

export class DbLockService {
  /**
   * Executes an action under a distributed PostgreSQL advisory lock.
   * If another serverless instance or job is already holding the lock,
   * execution is safely skipped without throwing an error.
   *
   * @param lockKey Unique lock identifier (e.g. 'tennisscope:sync:ranking')
   * @param action Async operation to execute
   */
  async withLock<T>(
    lockKey: string,
    action: () => Promise<T>
  ): Promise<DbLockResult<T>> {
    // 1. Synchronous in-process lock check (prevents same-process / same-connection race conditions)
    if (inMemoryLocks.get(lockKey)) {
      console.warn(`[DbLockService] In-process lock already held for "${lockKey}". Skipping.`);
      return {
        acquired: false,
        executed: false,
        reason: 'LOCKED_BY_ANOTHER_INSTANCE',
      };
    }

    // Acquire in-process lock synchronously before any async await
    inMemoryLocks.set(lockKey, true);

    let isDbAdvisory = false;

    try {
      // 2. Attempt PostgreSQL non-blocking advisory lock for cross-instance coordination
      const lockQueryResult = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_lock(hashtext(${lockKey})) AS acquired
      `;

      if (lockQueryResult && lockQueryResult.length > 0 && lockQueryResult[0].acquired === true) {
        isDbAdvisory = true;
      } else {
        // Another PostgreSQL session/instance is holding the lock
        inMemoryLocks.delete(lockKey);
        return {
          acquired: false,
          executed: false,
          reason: 'LOCKED_BY_ANOTHER_INSTANCE',
        };
      }
    } catch (dbErr) {
      // If PostgreSQL raw query fails (e.g. in mocked unit tests without Postgres), keep in-memory lock
      console.warn(`[DbLockService] Postgres advisory lock check failed, using fallback lock for "${lockKey}":`, (dbErr as Error).message);
      isDbAdvisory = false;
    }

    try {
      const result = await action();
      return {
        acquired: true,
        executed: true,
        result,
      };
    } finally {
      // Always release both in-process and database locks
      inMemoryLocks.delete(lockKey);

      if (isDbAdvisory) {
        try {
          await prisma.$queryRaw`
            SELECT pg_advisory_unlock(hashtext(${lockKey}))
          `;
        } catch (unlockErr) {
          console.error(`[DbLockService] Failed to release Postgres advisory lock for "${lockKey}":`, unlockErr);
        }
      }
    }
  }
}

export const dbLockService = new DbLockService();
