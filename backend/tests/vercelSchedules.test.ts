import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runScheduledRanking, POST as rankingHandler } from '../api/schedule-ranking';
import { runScheduledMatches, POST as matchHandler } from '../api/schedule-matches';
import { runScheduledProfileReconcile, POST as profileHandler } from '../api/schedule-profile-reconcile';
import { env } from '../src/config/env';
import { rankingSyncService } from '../src/modules/sync/rankingSync.service';
import { matchSyncService } from '../src/modules/sync/matchSync.service';
import { profileSyncService } from '../src/modules/sync/profileSync.service';

describe('Vercel Schedules Private Functions & Security Gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Production Cron Safety Gate (ENABLE_PRODUCTION_CRON=false)', () => {
    it('ranking schedule should exit safely without calling provider sync when gate is false', async () => {
      // In tests / default, ENABLE_PRODUCTION_CRON is false
      const syncSpy = vi.spyOn(rankingSyncService, 'sync').mockResolvedValue({
        snapshotId: 1,
        playersTracked: 100,
        entered: [],
        left: [],
        requestsUsed: 0,
      });

      const result = await runScheduledRanking();

      expect(result.executed).toBe(false);
      expect(result.reason).toBe('PRODUCTION_CRON_DISABLED');
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('match schedule should exit safely without calling provider sync when gate is false', async () => {
      const syncSpy = vi.spyOn(matchSyncService, 'sync').mockResolvedValue({
        processed: 0,
        inserted: 0,
        ignoredOutsideTop100: 0,
        skipped: 0,
        requestsUsed: 0,
      });

      const result = await runScheduledMatches();

      expect(result.executed).toBe(false);
      expect(result.reason).toBe('PRODUCTION_CRON_DISABLED');
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('profile reconcile schedule should exit safely without calling provider sync when gate is false', async () => {
      const processSpy = vi.spyOn(profileSyncService, 'processPendingProfiles').mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
        remainingPending: 0,
        requestsUsed: 0,
      });

      const result = await runScheduledProfileReconcile();

      expect(result.executed).toBe(false);
      expect(result.reason).toBe('PRODUCTION_CRON_DISABLED');
      expect(processSpy).not.toHaveBeenCalled();
    });
  });

  describe('Preview Deployment Gate (VERCEL_ENV != production)', () => {
    it('should skip execution in preview environment even if gate was true', async () => {
      // Temporarily simulate preview environment
      const originalVercelEnv = env.VERCEL_ENV;
      const originalGate = env.ENABLE_PRODUCTION_CRON;

      (env as any).VERCEL_ENV = 'preview';
      (env as any).ENABLE_PRODUCTION_CRON = true;

      const rankingSpy = vi.spyOn(rankingSyncService, 'sync');
      const matchSpy = vi.spyOn(matchSyncService, 'sync');

      const rankingRes = await runScheduledRanking();
      const matchRes = await runScheduledMatches();

      expect(rankingRes.executed).toBe(false);
      expect(rankingRes.reason).toBe('PREVIEW_ENVIRONMENT');
      expect(rankingSpy).not.toHaveBeenCalled();

      expect(matchRes.executed).toBe(false);
      expect(matchRes.reason).toBe('PREVIEW_ENVIRONMENT');
      expect(matchSpy).not.toHaveBeenCalled();

      // Restore
      (env as any).VERCEL_ENV = originalVercelEnv;
      (env as any).ENABLE_PRODUCTION_CRON = originalGate;
    });
  });

  describe('Mocked Execution when ENABLE_PRODUCTION_CRON=true', () => {
    it('should invoke mocked ranking sync when gate is enabled', async () => {
      const originalGate = env.ENABLE_PRODUCTION_CRON;
      (env as any).ENABLE_PRODUCTION_CRON = true;

      const mockData = {
        snapshotId: 999,
        playersTracked: 100,
        entered: [],
        left: [],
        requestsUsed: 0,
      };
      const syncSpy = vi.spyOn(rankingSyncService, 'sync').mockResolvedValue(mockData);

      const result = await runScheduledRanking();

      expect(result.executed).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      (env as any).ENABLE_PRODUCTION_CRON = originalGate;
    });

    it('should invoke mocked match sync when gate is enabled', async () => {
      const originalGate = env.ENABLE_PRODUCTION_CRON;
      (env as any).ENABLE_PRODUCTION_CRON = true;

      const mockData = {
        processed: 5,
        inserted: 2,
        ignoredOutsideTop100: 3,
        skipped: 0,
        requestsUsed: 0,
      };
      const syncSpy = vi.spyOn(matchSyncService, 'sync').mockResolvedValue(mockData);

      const result = await runScheduledMatches();

      expect(result.executed).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      (env as any).ENABLE_PRODUCTION_CRON = originalGate;
    });

    it('should invoke mocked profile reconcile when gate is enabled', async () => {
      const originalGate = env.ENABLE_PRODUCTION_CRON;
      (env as any).ENABLE_PRODUCTION_CRON = true;

      const mockData = {
        processed: 10,
        succeeded: 10,
        failed: 0,
        remainingPending: 46,
        requestsUsed: 0,
      };
      const processSpy = vi.spyOn(profileSyncService, 'processPendingProfiles').mockResolvedValue(mockData);

      const result = await runScheduledProfileReconcile();

      expect(result.executed).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(processSpy).toHaveBeenCalledTimes(1);

      (env as any).ENABLE_PRODUCTION_CRON = originalGate;
    });
  });

  describe('Private Function Security (@vercel/schedules rejection of public unauthenticated calls)', () => {
    it('should reject unauthenticated HTTP requests missing Vercel CloudEvent headers with 400 Bad Request', async () => {
      // Normal external HTTP request without CloudEvent headers
      const fakeRequest = new Request('http://localhost:5000/api/schedule-ranking', {
        method: 'POST',
      });

      const response = await rankingHandler(fakeRequest);
      expect(response.status).toBe(400);

      const matchResponse = await matchHandler(fakeRequest);
      expect(matchResponse.status).toBe(400);

      const profileResponse = await profileHandler(fakeRequest);
      expect(profileResponse.status).toBe(400);
    });
  });
});
