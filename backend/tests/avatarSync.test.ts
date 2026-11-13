import { describe, it, expect, vi, afterEach } from 'vitest';
import { avatarSyncService } from '../src/modules/sync/avatarSync.service';
import { tennisApiClient } from '../src/clients/tennisApi.client';
import { syncRepository } from '../src/modules/sync/sync.repository';
import { prisma } from '../src/config/database';
import { SyncJobType } from '@prisma/client';
import fs from 'fs';

describe('Player Avatar Sync Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Local Disk Detection and Validation', () => {
    it('should return false if avatar file does not exist on disk', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(avatarSyncService.hasAvatarOnDisk(12345678)).toBe(false);
    });

    it('should return true if avatar file exists and has positive size', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 2048 } as fs.Stats);
      expect(avatarSyncService.hasAvatarOnDisk(12345678)).toBe(true);
    });

    it('should return false if avatar file exists but is 0 bytes (corrupted)', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 0 } as fs.Stats);
      expect(avatarSyncService.hasAvatarOnDisk(12345678)).toBe(false);
    });
  });

  describe('Audit and Automatic DB/Disk Repair', () => {
    it('should audit current Top 100 without consuming any API quota', async () => {
      const getProfileSpy = vi.spyOn(tennisApiClient, 'getPlayerProfile');

      const audit = await avatarSyncService.auditCurrentTop100({ autoRepair: false });

      expect(audit.totalPlayers).toBeGreaterThanOrEqual(0);
      expect(getProfileSpy).not.toHaveBeenCalled();
    });

    it('should auto-repair DB path when avatar file exists on disk but DB imagePath is null', async () => {
      const testExternalId = 999991;
      const testPlayer = await prisma.player.upsert({
        where: { externalId: testExternalId },
        create: {
          externalId: testExternalId,
          name: 'Avatar Disk Test Player',
          imagePath: null,
        },
        update: {
          imagePath: null,
        },
      });

      // Mock disk has file
      vi.spyOn(avatarSyncService, 'hasAvatarOnDisk').mockImplementation((extId) => {
        return extId === testExternalId;
      });

      try {
        const result = await avatarSyncService.syncPlayerAvatar(testExternalId);
        expect(result.status).toBe('ALREADY_VALID');
        expect(result.requestsUsed).toBe(0);

        const updated = await prisma.player.findUnique({ where: { id: testPlayer.id } });
        expect(updated?.imagePath).toBe(`/api/images/players/${testExternalId}.png`);
      } finally {
        await prisma.player.deleteMany({ where: { externalId: testExternalId } });
      }
    });
  });

  describe('Quota Guards & Budget Preservation', () => {
    it('should respect safety buffer and NOT download avatars when budget is low', async () => {
      // Simulate budget remaining = 8, which is below safetyBuffer = 10
      vi.spyOn(tennisApiClient, 'getRemainingBudget').mockResolvedValue(8);
      vi.spyOn(avatarSyncService, 'auditCurrentTop100').mockResolvedValue({
        rankingDate: new Date(),
        totalPlayers: 100,
        validAvatars: 10,
        missingAvatars: 90,
        repairedMismatches: 0,
        pendingJobs: 0,
        items: [
          {
            rank: 1,
            internalId: 1,
            externalId: 10001,
            name: 'Player 1',
            countryCode: 'GER',
            dbImagePath: null,
            hasFileOnDisk: false,
            isValid: false,
            needsRepair: false,
            hasPendingJob: false,
          },
        ],
      });

      const syncPlayerAvatarSpy = vi.spyOn(avatarSyncService, 'syncPlayerAvatar');

      const result = await avatarSyncService.syncTop100Avatars({ safetyBuffer: 10 });

      expect(result.downloaded).toBe(0);
      expect(syncPlayerAvatarSpy).not.toHaveBeenCalled();
      expect(result.processedPlayers[0].status).toBe('SKIPPED_BUDGET');
    });

    it('should limit downloads to maxAvatars option even if budget permits more', async () => {
      // Budget allows 20 requests (effective 10 requests = 5 avatars)
      vi.spyOn(tennisApiClient, 'getRemainingBudget').mockResolvedValue(20);
      vi.spyOn(avatarSyncService, 'auditCurrentTop100').mockResolvedValue({
        rankingDate: new Date(),
        totalPlayers: 100,
        validAvatars: 0,
        missingAvatars: 100,
        repairedMismatches: 0,
        pendingJobs: 0,
        items: [
          {
            rank: 1,
            internalId: 1,
            externalId: 10001,
            name: 'Player 1',
            countryCode: 'GER',
            dbImagePath: null,
            hasFileOnDisk: false,
            isValid: false,
            needsRepair: false,
            hasPendingJob: false,
          },
          {
            rank: 2,
            internalId: 2,
            externalId: 10002,
            name: 'Player 2',
            countryCode: 'ITA',
            dbImagePath: null,
            hasFileOnDisk: false,
            isValid: false,
            needsRepair: false,
            hasPendingJob: false,
          },
        ],
      });

      vi.spyOn(avatarSyncService, 'syncPlayerAvatar').mockResolvedValue({
        status: 'DOWNLOADED',
        requestsUsed: 2,
      });

      // Limit to 1 avatar
      const result = await avatarSyncService.syncTop100Avatars({
        maxAvatars: 1,
        safetyBuffer: 10,
      });

      expect(result.downloaded).toBe(1);
    });
  });

  describe('Pending Job Queue for ENTERED Players', () => {
    it('should create PLAYER_IMAGE pending job if not already present', async () => {
      const testExternalId = 999992;
      const job = await syncRepository.createJobIfNeeded(
        SyncJobType.PLAYER_IMAGE,
        String(testExternalId),
        { rank: 50, name: 'Entered Test Player' },
        30
      );

      expect(job).not.toBeNull();
      expect(job?.type).toBe(SyncJobType.PLAYER_IMAGE);
      expect(job?.targetKey).toBe(String(testExternalId));

      // Attempting to create duplicate within freshness cooldown returns null
      const duplicate = await syncRepository.createJobIfNeeded(
        SyncJobType.PLAYER_IMAGE,
        String(testExternalId),
        undefined,
        30
      );
      expect(duplicate).toBeNull();

      // Cleanup
      if (job?.id) {
        await prisma.syncJob.delete({ where: { id: job.id } });
      }
    });
  });

  describe('Automatic Avatar Consumption Pause & Feature Gate', () => {
    it('isAutoAvatarSyncEnabled should be false by default', () => {
      expect(avatarSyncService.isAutoAvatarSyncEnabled()).toBe(false);
    });

    it('processPendingAvatars should return 0 and make 0 API calls when auto sync is paused', async () => {
      const getBudgetSpy = vi.spyOn(tennisApiClient, 'getRemainingBudget');
      const getProfileSpy = vi.spyOn(tennisApiClient, 'getPlayerProfile');

      const processed = await avatarSyncService.processPendingAvatars(10);

      expect(processed).toBe(0);
      expect(getBudgetSpy).not.toHaveBeenCalled();
      expect(getProfileSpy).not.toHaveBeenCalled();
    });
  });
});
