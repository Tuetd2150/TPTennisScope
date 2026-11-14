import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env, getAllowedOrigins } from '../src/config/env';
import { dbLockService, DbLockService } from '../src/modules/sync/dbLock.service';
import { prisma } from '../src/config/database';

describe('Deployment & Vercel Compatibility Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe('CORS Configuration', () => {
    it('should parse and merge multiple origins from FRONTEND_ORIGIN and FRONTEND_ORIGINS', () => {
      const origins = getAllowedOrigins();
      expect(origins).toContain('http://localhost:5173');
    });

    it('should allow GET /api/health with or without origin header', async () => {
      const resWithoutOrigin = await request(app).get('/api/health');
      expect(resWithoutOrigin.status).toBe(200);
      expect(resWithoutOrigin.body.status).toBe('ok');

      const resWithOrigin = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');
      expect(resWithOrigin.status).toBe(200);
      expect(resWithOrigin.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('Vercel Cron Authentication & Environment Gates', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/cron/ranking');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing Authorization header/i);
    });

    it('should return 401 when Authorization format is invalid', async () => {
      const res = await request(app)
        .get('/api/cron/ranking')
        .set('Authorization', 'Basic invalidformat');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Expected Bearer token/i);
    });

    it('should return 401 when cron token is incorrect', async () => {
      const res = await request(app)
        .get('/api/cron/ranking')
        .set('Authorization', 'Bearer wrong_secret');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid cron secret/i);
    });

    it('should return 200 with skipped status when ENABLE_PRODUCTION_CRON is false', async () => {
      const secret = env.CRON_SECRET || 'test_dev_cron_secret';
      const res = await request(app)
        .get('/api/cron/ranking')
        .set('Authorization', `Bearer ${secret}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('skipped');
      expect(res.body.reason).toBe('PRODUCTION_CRON_DISABLED');
    });

    it('should support both GET and POST methods for Vercel Cron endpoints', async () => {
      const secret = env.CRON_SECRET || 'test_dev_cron_secret';
      
      const getRes = await request(app)
        .get('/api/cron/matches')
        .set('Authorization', `Bearer ${secret}`);
      expect(getRes.status).toBe(200);

      const postRes = await request(app)
        .post('/api/cron/matches')
        .set('Authorization', `Bearer ${secret}`);
      expect(postRes.status).toBe(200);
    });
  });

  describe('Serverless Anti-Overlap DB Lock (DbLockService)', () => {
    it('should execute action when lock is acquired and prevent concurrent runs of the same key', async () => {
      const lockKey = 'test:lock:anti-overlap';
      let executionCount = 0;

      // First call acquires lock and holds it during async delay
      const promise1 = dbLockService.withLock(lockKey, async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'success1';
      });

      // Second call tries immediately with same key -> should skip
      const promise2 = dbLockService.withLock(lockKey, async () => {
        executionCount++;
        return 'success2';
      });

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(res1.executed).toBe(true);
      expect(res1.result).toBe('success1');

      expect(res2.executed).toBe(false);
      expect(res2.reason).toBe('LOCKED_BY_ANOTHER_INSTANCE');
      expect(executionCount).toBe(1);

      // After lock is released, next execution succeeds
      const res3 = await dbLockService.withLock(lockKey, async () => {
        executionCount++;
        return 'success3';
      });

      expect(res3.executed).toBe(true);
      expect(res3.result).toBe('success3');
      expect(executionCount).toBe(2);
    });

    it('should release lock cleanly even if the action throws an error', async () => {
      const lockKey = 'test:lock:error-handling';

      await expect(
        dbLockService.withLock(lockKey, async () => {
          throw new Error('Simulated failure inside locked action');
        })
      ).rejects.toThrow('Simulated failure inside locked action');

      // Subsequent call should still be able to acquire the lock
      const retryRes = await dbLockService.withLock(lockKey, async () => 'recovered');
      expect(retryRes.executed).toBe(true);
      expect(retryRes.result).toBe('recovered');
    });

    it('should atomically serialize concurrent lease claims from separate serverless instances on the same lockKey', async () => {
      const lockKey = 'test:lock:multi-instance-race';

      // Clean up any lingering test jobs
      await prisma.syncJob.deleteMany({
        where: { targetKey: lockKey },
      });

      // Simulate 2 separate serverless instances (distinct memory spaces / distinct inProcessLocks)
      const instanceA = new DbLockService();
      const instanceB = new DbLockService();

      let executions = 0;

      // Both instances invoke withLock at the exact same time
      const [resA, resB] = await Promise.all([
        instanceA.withLock(lockKey, async () => {
          executions++;
          await new Promise((resolve) => setTimeout(resolve, 80));
          return 'doneA';
        }),
        instanceB.withLock(lockKey, async () => {
          executions++;
          await new Promise((resolve) => setTimeout(resolve, 80));
          return 'doneB';
        }),
      ]);

      // Exactly one instance must have acquired and executed
      const executedResults = [resA, resB].filter((r) => r.executed);
      const skippedResults = [resA, resB].filter((r) => !r.executed);

      expect(executedResults).toHaveLength(1);
      expect(skippedResults).toHaveLength(1);
      expect(skippedResults[0].reason).toBe('LOCKED_BY_ANOTHER_INSTANCE');
      expect(executions).toBe(1);

      // Clean up test job
      await prisma.syncJob.deleteMany({
        where: { targetKey: lockKey },
      });
    });

    it('should allow independent lock keys to execute concurrently without blocking each other', async () => {
      const lockKey1 = 'test:lock:ranking';
      const lockKey2 = 'test:lock:matches';

      // Clean up test jobs
      await prisma.syncJob.deleteMany({
        where: { targetKey: { in: [lockKey1, lockKey2] } },
      });

      const instanceA = new DbLockService();
      const instanceB = new DbLockService();

      const [res1, res2] = await Promise.all([
        instanceA.withLock(lockKey1, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'ranking_done';
        }),
        instanceB.withLock(lockKey2, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'matches_done';
        }),
      ]);

      expect(res1.executed).toBe(true);
      expect(res1.result).toBe('ranking_done');

      expect(res2.executed).toBe(true);
      expect(res2.result).toBe('matches_done');

      // Clean up test jobs
      await prisma.syncJob.deleteMany({
        where: { targetKey: { in: [lockKey1, lockKey2] } },
      });
    });
  });
});
