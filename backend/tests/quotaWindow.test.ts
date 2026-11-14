import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseQuotaResetTime,
  getQuotaWindowStart,
  getQuotaWindowEnd,
  getQuotaWindowKey,
} from '../src/utils/quotaWindow';
import { syncRepository } from '../src/modules/sync/sync.repository';
import { tennisApiClient } from '../src/clients/tennisApi.client';
import { prisma } from '../src/config/database';
import { SyncJobType, SyncJobStatus } from '@prisma/client';

describe('RapidAPI Quota Window Calculation & Atomicity', () => {
  describe('Quota Window Time Calculations (08:23 UTC Reset)', () => {
    it('1. should place 08:22:59 UTC into the previous day bucket', () => {
      const date = new Date('2026-11-14T08:22:59.000Z');
      const windowKey = getQuotaWindowKey(date);

      expect(windowKey).toBe('2026-11-13T08:23:00Z');
      expect(getQuotaWindowStart(date).toISOString()).toBe('2026-11-13T08:23:00.000Z');
      expect(getQuotaWindowEnd(date).toISOString()).toBe('2026-11-14T08:23:00.000Z');
    });

    it('2. should place 08:23:00 UTC into the new day bucket', () => {
      const date = new Date('2026-11-14T08:23:00.000Z');
      const windowKey = getQuotaWindowKey(date);

      expect(windowKey).toBe('2026-11-14T08:23:00Z');
      expect(getQuotaWindowStart(date).toISOString()).toBe('2026-11-14T08:23:00.000Z');
      expect(getQuotaWindowEnd(date).toISOString()).toBe('2026-11-15T08:23:00.000Z');
    });

    it('3. should place 15:22:59 Asia/Ho_Chi_Minh (+07:00) into the previous day bucket', () => {
      // 15:22:59 +07:00 is exactly 08:22:59 UTC
      const date = new Date('2026-11-14T15:22:59+07:00');
      const windowKey = getQuotaWindowKey(date);

      expect(windowKey).toBe('2026-11-13T08:23:00Z');
    });

    it('4. should place 15:23:00 Asia/Ho_Chi_Minh (+07:00) into the new day bucket', () => {
      // 15:23:00 +07:00 is exactly 08:23:00 UTC
      const date = new Date('2026-11-14T15:23:00+07:00');
      const windowKey = getQuotaWindowKey(date);

      expect(windowKey).toBe('2026-11-14T08:23:00Z');
    });

    it('should correctly handle month boundaries and leap year transitions', () => {
      // March 1st leap year 2024 before reset -> Feb 29 2024
      const leapDate = new Date('2024-03-01T05:00:00.000Z');
      expect(getQuotaWindowKey(leapDate)).toBe('2024-02-29T08:23:00Z');

      // Jan 1st 2027 before reset -> Dec 31 2026
      const newYearDate = new Date('2027-01-01T04:00:00.000Z');
      expect(getQuotaWindowKey(newYearDate)).toBe('2026-12-31T08:23:00Z');
    });

    it('should support custom reset time via argument or env', () => {
      const customTime = '12:00';
      const beforeCustom = new Date('2026-11-14T11:59:59.000Z');
      const afterCustom = new Date('2026-11-14T12:00:00.000Z');

      expect(getQuotaWindowKey(beforeCustom, customTime)).toBe('2026-11-13T12:00:00Z');
      expect(getQuotaWindowKey(afterCustom, customTime)).toBe('2026-11-14T12:00:00Z');
    });

    it('should fallback gracefully to 08:23 when reset time format is invalid', () => {
      const parsed = parseQuotaResetTime('invalid-time');
      expect(parsed).toEqual({ hour: 8, minute: 23 });
    });
  });

  describe('Database Quota Bucket Isolation & Atomic Reservations', () => {
    const testOldBucketKey = 'test:quota:2026-11-13T08:23:00Z';
    const testNewBucketKey = 'test:quota:2026-11-14T08:23:00Z';

    beforeEach(async () => {
      await prisma.syncJob.deleteMany({
        where: {
          targetKey: { in: [testOldBucketKey, testNewBucketKey] },
        },
      });
    });

    afterEach(async () => {
      await prisma.syncJob.deleteMany({
        where: {
          targetKey: { in: [testOldBucketKey, testNewBucketKey] },
        },
      });
    });

    it('5. budget of old bucket should NOT affect new bucket', async () => {
      // Simulate that old bucket used all 45 requests
      await prisma.syncJob.createMany({
        data: Array.from({ length: 45 }).map((_, idx) => ({
          type: SyncJobType.API_USAGE,
          status: SyncJobStatus.COMPLETED,
          targetKey: testOldBucketKey,
          requestsUsed: 1,
          payload: { path: `/old/test/${idx}`, attempt: 1 },
          startedAt: new Date('2026-11-13T10:00:00Z'),
          finishedAt: new Date('2026-11-13T10:00:00Z'),
        })),
      });

      // Verify old bucket is exhausted
      const oldUsed = await syncRepository.getApiRequestsUsed(testOldBucketKey);
      expect(oldUsed).toBe(45);

      const oldAttempt = await syncRepository.reserveApiRequest(
        testOldBucketKey,
        '/test/path',
        1,
        45
      );
      expect(oldAttempt).toBeNull(); // Old bucket cannot take any more requests

      // New bucket starts clean with 0 requests used
      const newUsed = await syncRepository.getApiRequestsUsed(testNewBucketKey);
      expect(newUsed).toBe(0);

      // Reserving in new bucket succeeds with 44 remaining
      const newRemaining = await syncRepository.reserveApiRequest(
        testNewBucketKey,
        '/test/path',
        1,
        45
      );
      expect(newRemaining).toBe(44);
    });

    it('6. reserveApiRequest() must be atomic under high concurrency', async () => {
      const budget = 5;

      // Launch 15 concurrent reservation attempts simultaneously for a budget of 5
      const attempts = Array.from({ length: 15 }).map((_, idx) =>
        syncRepository.reserveApiRequest(
          testNewBucketKey,
          `/concurrent/${idx}`,
          1,
          budget
        )
      );

      const results = await Promise.all(attempts);

      const successfulReservations = results.filter((res) => res !== null);
      const rejectedReservations = results.filter((res) => res === null);

      expect(successfulReservations).toHaveLength(5);
      expect(rejectedReservations).toHaveLength(10);

      // Remaining counts returned should match strictly 4, 3, 2, 1, 0 in some arrival order
      const remainingValues = (successfulReservations as number[]).sort((a, b) => b - a);
      expect(remainingValues).toEqual([4, 3, 2, 1, 0]);

      // Exactly 5 rows inserted in DB
      const totalCreated = await prisma.syncJob.count({
        where: {
          type: SyncJobType.API_USAGE,
          targetKey: testNewBucketKey,
        },
      });
      expect(totalCreated).toBe(5);
    });

    it('7. must never exceed 45 requests within the same quota window', async () => {
      const maxBudget = 45;

      // Reserve 45 requests
      for (let i = 0; i < maxBudget; i++) {
        const remaining = await syncRepository.reserveApiRequest(
          testNewBucketKey,
          `/item/${i}`,
          1,
          maxBudget
        );
        expect(remaining).toBe(maxBudget - 1 - i);
      }

      // The 46th request MUST be rejected
      const overflow = await syncRepository.reserveApiRequest(
        testNewBucketKey,
        '/item/46',
        1,
        maxBudget
      );
      expect(overflow).toBeNull();

      const totalUsed = await syncRepository.getApiRequestsUsed(testNewBucketKey);
      expect(totalUsed).toBe(45);
    });

    it('tennisApiClient should integrate with the dynamic quota key', async () => {
      const currentQuotaKey = tennisApiClient.getCurrentQuotaKey();
      expect(currentQuotaKey).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

      const usedCount = await tennisApiClient.getTodayRequestCount();
      expect(typeof usedCount).toBe('number');

      const remainingBudget = await tennisApiClient.getRemainingBudget();
      expect(remainingBudget).toBeGreaterThanOrEqual(0);
      expect(remainingBudget).toBeLessThanOrEqual(45);
    });
  });
});
