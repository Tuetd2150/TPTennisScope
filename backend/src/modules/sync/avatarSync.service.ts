import fs from 'fs';
import path from 'path';
import { SyncService } from './sync.service';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { syncRepository } from './sync.repository';
import { prisma } from '../../config/database';
import { SyncJobType, SyncJobStatus } from '@prisma/client';
import { normalizeCountryCode } from '../../utils/country';

export interface AvatarSyncAuditItem {
  rank: number;
  internalId: number;
  externalId: number;
  name: string;
  countryCode: string | null;
  dbImagePath: string | null;
  hasFileOnDisk: boolean;
  isValid: boolean;
  needsRepair: boolean;
  hasPendingJob: boolean;
}

export interface AvatarSyncAuditResult {
  rankingDate: Date | null;
  totalPlayers: number;
  validAvatars: number;
  missingAvatars: number;
  repairedMismatches: number;
  pendingJobs: number;
  items: AvatarSyncAuditItem[];
}

export interface AvatarBatchSyncOptions {
  /** Maximum number of avatars to download in this batch. Defaults to budget-derived limit. */
  maxAvatars?: number;
  /** Reserved quota buffer for ranking sync (1) + match sync (4-8) + safety margin. Defaults to 10. */
  safetyBuffer?: number;
  /** If true, run country repair from birthplace alongside audit/sync (0 quota cost). Defaults to true. */
  repairCountries?: boolean;
}

export interface AvatarBatchSyncResult {
  totalTop100: number;
  alreadyValidBefore: number;
  repairedBefore: number;
  downloaded: number;
  failed: number;
  pendingRemaining: number;
  validAvatarsAfter: number;
  coveragePct: number;
  requestsUsed: number;
  remainingBudget: number;
  safetyBuffer: number;
  processedPlayers: Array<{
    rank: number;
    externalId: number;
    name: string;
    status: 'ALREADY_VALID' | 'REPAIRED_DB' | 'DOWNLOADED' | 'NO_IMAGE' | 'FAILED' | 'SKIPPED_BUDGET';
    error?: string;
  }>;
}

export class AvatarSyncService extends SyncService {
  private getStorageDir(): string {
    const dir = path.join(__dirname, '..', '..', '..', 'storage', 'player-images');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private getLocalFilePath(externalId: number): string {
    return path.join(this.getStorageDir(), `${externalId}.png`);
  }

  private getPublicPath(externalId: number): string {
    return `/api/images/players/${externalId}.png`;
  }

  /**
   * Checks if an avatar is physically present on disk and has non-zero size.
   */
  public hasAvatarOnDisk(externalId: number): boolean {
    const localPath = this.getLocalFilePath(externalId);
    if (!fs.existsSync(localPath)) {
      return false;
    }
    try {
      const stats = fs.statSync(localPath);
      return stats.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Audits avatar coverage for the Current Dynamic Top 100 players from the latest RankingSnapshot.
   * Performs read-only DB/disk check and repairs DB-file mismatches without using any quota.
   */
  async auditCurrentTop100(options?: { autoRepair?: boolean }): Promise<AvatarSyncAuditResult> {
    const autoRepair = options?.autoRepair ?? true;

    const latestSnapshot = await prisma.rankingSnapshot.findFirst({
      orderBy: { rankingDate: 'desc' },
      select: { rankingDate: true },
    });

    if (!latestSnapshot) {
      return {
        rankingDate: null,
        totalPlayers: 0,
        validAvatars: 0,
        missingAvatars: 0,
        repairedMismatches: 0,
        pendingJobs: 0,
        items: [],
      };
    }

    const top100Rows = await prisma.rankingSnapshot.findMany({
      where: {
        rankingDate: latestSnapshot.rankingDate,
        rank: { lte: 100 },
      },
      orderBy: { rank: 'asc' },
      include: {
        player: {
          select: {
            id: true,
            externalId: true,
            name: true,
            countryCode: true,
            imagePath: true,
          },
        },
      },
    });

    const pendingJobs = await syncRepository.getPendingJobs(SyncJobType.PLAYER_IMAGE, 200);
    const pendingSet = new Set(pendingJobs.map((j) => j.targetKey));

    let validCount = 0;
    let missingCount = 0;
    let repairedCount = 0;
    const items: AvatarSyncAuditItem[] = [];

    for (const row of top100Rows) {
      const player = row.player;
      const fileExists = this.hasAvatarOnDisk(player.externalId);
      const expectedPublicPath = this.getPublicPath(player.externalId);
      const hasDbPath = Boolean(player.imagePath);

      let isValid = false;
      let needsRepair = false;

      if (fileExists && hasDbPath) {
        isValid = true;
      } else if (fileExists && !hasDbPath) {
        // Disk has file but DB missing path -> repair DB
        needsRepair = true;
        if (autoRepair) {
          await prisma.player.update({
            where: { id: player.id },
            data: { imagePath: expectedPublicPath },
          });
          isValid = true;
          repairedCount++;
        }
      } else if (!fileExists && hasDbPath) {
        // DB says has path but file is missing -> repair DB to null
        needsRepair = true;
        if (autoRepair) {
          await prisma.player.update({
            where: { id: player.id },
            data: { imagePath: null },
          });
          repairedCount++;
        }
      }

      if (isValid) {
        validCount++;
      } else {
        missingCount++;
      }

      items.push({
        rank: row.rank,
        internalId: player.id,
        externalId: player.externalId,
        name: player.name,
        countryCode: player.countryCode,
        dbImagePath: isValid ? expectedPublicPath : player.imagePath,
        hasFileOnDisk: fileExists,
        isValid,
        needsRepair,
        hasPendingJob: pendingSet.has(String(player.externalId)),
      });
    }

    return {
      rankingDate: latestSnapshot.rankingDate,
      totalPlayers: top100Rows.length,
      validAvatars: validCount,
      missingAvatars: missingCount,
      repairedMismatches: repairedCount,
      pendingJobs: pendingJobs.length,
      items,
    };
  }

  /**
   * Synchronizes a single player's avatar.
   * Idempotent: skips if avatar already exists on disk and in DB.
   * If remote image is missing or returns 404, handles gracefully without crashing.
   */
  async syncPlayerAvatar(
    externalId: number,
    options?: { existingJobId?: number; force?: boolean }
  ): Promise<{ status: 'ALREADY_VALID' | 'DOWNLOADED' | 'NO_IMAGE' | 'FAILED'; requestsUsed: number }> {
    const localPath = this.getLocalFilePath(externalId);
    const publicPath = this.getPublicPath(externalId);
    const force = options?.force ?? false;

    // 1. Check if already valid locally
    if (!force && this.hasAvatarOnDisk(externalId)) {
      // Ensure DB points to it
      await prisma.player.updateMany({
        where: { externalId },
        data: { imagePath: publicPath },
      });
      return { status: 'ALREADY_VALID', requestsUsed: 0 };
    }

    // 2. Budget safety check: need up to 2 requests (1 profile + 1 image)
    const remaining = await tennisApiClient.getRemainingBudget();
    if (remaining < 2) {
      throw new Error(`[AvatarSync] Insufficient budget for avatar sync. Need 2, have ${remaining}`);
    }

    const job = options?.existingJobId
      ? { id: options.existingJobId }
      : await syncRepository.createJob(SyncJobType.PLAYER_IMAGE, String(externalId));

    await syncRepository.updateJob(job.id, {
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
    });

    let requestsUsed = 0;

    try {
      // Step A: Fetch player profile to retrieve image URL & fresh metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileResponse: any = await tennisApiClient.getPlayerProfile(externalId);
      requestsUsed++;
      const profile = profileResponse?.data;

      if (!profile?.id) {
        throw new Error(`Invalid player profile response for externalId ${externalId}`);
      }

      const remoteUrl = profile.imagePath || profile.image;

      // Update basic profile fields if player exists in DB
      if (profile.name) {
        const birthplace = profile.information?.birthplace ?? profile.birthplace ?? null;
        const resolvedCountry = normalizeCountryCode(
          profile.countryAcr ?? profile.country?.acronym ?? profile.country?.nameCode ?? profile.country?.id
        );

        await prisma.player.updateMany({
          where: { externalId },
          data: {
            name: profile.name,
            ...(resolvedCountry ? { countryCode: resolvedCountry } : {}),
            ...(birthplace ? { birthplace } : {}),
          },
        });
      }

      if (!remoteUrl) {
        // Profile does not have an image URL
        await syncRepository.updateJob(job.id, {
          status: SyncJobStatus.COMPLETED,
          finishedAt: new Date(),
          requestsUsed,
          errorMessage: 'No remote image URL in player profile',
        });
        return { status: 'NO_IMAGE', requestsUsed };
      }

      // Step B: Download image buffer via RapidAPI client
      const imageBuffer = await tennisApiClient.getPlayerImage(remoteUrl);
      requestsUsed++;

      // Save buffer to disk
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localPath, imageBuffer);

      // Step C: Update DB imagePath
      await prisma.player.updateMany({
        where: { externalId },
        data: { imagePath: publicPath },
      });

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
        requestsUsed,
        errorMessage: null,
      });

      console.log(`[AvatarSync] Successfully downloaded and cached avatar for ${profile.name} (${externalId})`);
      return { status: 'DOWNLOADED', requestsUsed };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.FAILED,
        finishedAt: new Date(),
        requestsUsed,
        errorMessage: message,
      });

      console.warn(`[AvatarSync] Failed to sync avatar for ${externalId}: ${message}`);
      return { status: 'FAILED', requestsUsed };
    }
  }

  /**
   * Main controlled batch runner for Top 100 avatar sync.
   * Respects daily API budget, leaves safety buffer for ranking/match sync,
   * skips valid avatars, repairs mismatches, and preserves pending jobs for remaining players.
   */
  async syncTop100Avatars(options?: AvatarBatchSyncOptions): Promise<AvatarBatchSyncResult> {
    const safetyBuffer = options?.safetyBuffer ?? 10;

    // 1. Audit current Top 100 and auto-repair DB/disk mismatches
    const auditBefore = await this.auditCurrentTop100({ autoRepair: true });

    const totalRemainingBudget = await tennisApiClient.getRemainingBudget();
    const effectiveBudget = Math.max(0, totalRemainingBudget - safetyBuffer);

    // Each avatar takes up to 2 requests. Max avatars we can safely download today:
    const maxPossibleAvatars = Math.floor(effectiveBudget / 2);
    const maxAvatarsToRun =
      options?.maxAvatars != null
        ? Math.min(options.maxAvatars, maxPossibleAvatars)
        : maxPossibleAvatars;

    console.log(
      `[AvatarSync] Top 100 audit: ${auditBefore.validAvatars} valid, ${auditBefore.missingAvatars} missing. ` +
        `Budget: ${totalRemainingBudget} remaining (Safety buffer: ${safetyBuffer}, Effective: ${effectiveBudget}). ` +
        `Max avatars to download this batch: ${maxAvatarsToRun}`
    );

    let downloadedCount = 0;
    let failedCount = 0;
    let batchRequestsUsed = 0;
    const processedPlayers: AvatarBatchSyncResult['processedPlayers'] = [];

    // Filter missing players in rank order
    const missingPlayers = auditBefore.items.filter((item) => !item.isValid);

    // Ensure all missing players have a PENDING SyncJob for tracking
    for (const p of missingPlayers) {
      await syncRepository.createJobIfNeeded(
        SyncJobType.PLAYER_IMAGE,
        String(p.externalId),
        { rank: p.rank, name: p.name },
        30
      );
    }

    // Download avatars up to quota cap
    for (const playerItem of missingPlayers) {
      // Check if we reached batch target or if remaining budget dropped below 2
      const currentRemaining = await tennisApiClient.getRemainingBudget();
      if (downloadedCount >= maxAvatarsToRun || currentRemaining < safetyBuffer + 2) {
        processedPlayers.push({
          rank: playerItem.rank,
          externalId: playerItem.externalId,
          name: playerItem.name,
          status: 'SKIPPED_BUDGET',
        });
        continue;
      }

      console.log(
        `[AvatarSync] Processing #${playerItem.rank} ${playerItem.name} (${playerItem.externalId})...`
      );

      const result = await this.syncPlayerAvatar(playerItem.externalId);
      batchRequestsUsed += result.requestsUsed;

      if (result.status === 'DOWNLOADED') {
        downloadedCount++;
        processedPlayers.push({
          rank: playerItem.rank,
          externalId: playerItem.externalId,
          name: playerItem.name,
          status: 'DOWNLOADED',
        });
      } else if (result.status === 'NO_IMAGE') {
        processedPlayers.push({
          rank: playerItem.rank,
          externalId: playerItem.externalId,
          name: playerItem.name,
          status: 'NO_IMAGE',
        });
      } else if (result.status === 'ALREADY_VALID') {
        processedPlayers.push({
          rank: playerItem.rank,
          externalId: playerItem.externalId,
          name: playerItem.name,
          status: 'ALREADY_VALID',
        });
      } else {
        failedCount++;
        processedPlayers.push({
          rank: playerItem.rank,
          externalId: playerItem.externalId,
          name: playerItem.name,
          status: 'FAILED',
        });
      }
    }

    // Final audit
    const auditAfter = await this.auditCurrentTop100({ autoRepair: false });
    const finalRemaining = await tennisApiClient.getRemainingBudget();
    const coveragePct =
      auditAfter.totalPlayers > 0
        ? Math.round((auditAfter.validAvatars / auditAfter.totalPlayers) * 100)
        : 0;

    return {
      totalTop100: auditBefore.totalPlayers,
      alreadyValidBefore: auditBefore.validAvatars,
      repairedBefore: auditBefore.repairedMismatches,
      downloaded: downloadedCount,
      failed: failedCount,
      pendingRemaining: auditAfter.missingAvatars,
      validAvatarsAfter: auditAfter.validAvatars,
      coveragePct,
      requestsUsed: batchRequestsUsed,
      remainingBudget: finalRemaining,
      safetyBuffer,
      processedPlayers,
    };
  }

  /**
   * Feature gate: automatic avatar downloading is PAUSED by default
   * until a validated working remote avatar source or CDN is confirmed.
   * Prevents consuming API quota while preserving PENDING job tracking.
   */
  public isAutoAvatarSyncEnabled(): boolean {
    return false;
  }

  /**
   * Processes pending PLAYER_IMAGE jobs created by RankingSync (e.g. for ENTERED players).
   * Safe to call from scheduler or ranking sync post-hook.
   * If auto avatar sync is paused/disabled, safely exits without consuming any quota.
   */
  async processPendingAvatars(limit: number = 2): Promise<number> {
    if (!this.isAutoAvatarSyncEnabled()) {
      console.log('[AvatarSync] Automatic avatar consumption is PAUSED. Preserving pending jobs without calling API.');
      return 0;
    }

    const safetyBuffer = 10;
    const remaining = await tennisApiClient.getRemainingBudget();
    if (remaining <= safetyBuffer + 1) {
      console.log(`[AvatarSync] Budget near safety buffer (${remaining} <= ${safetyBuffer + 1}), skipping pending avatar jobs`);
      return 0;
    }

    const pendingJobs = await syncRepository.getPendingJobs(SyncJobType.PLAYER_IMAGE, limit);
    let processed = 0;

    for (const job of pendingJobs) {
      if (!job.targetKey) continue;
      const externalId = parseInt(job.targetKey, 10);
      if (Number.isNaN(externalId)) continue;

      const currentBudget = await tennisApiClient.getRemainingBudget();
      if (currentBudget <= safetyBuffer + 1) {
        break;
      }

      try {
        await this.syncPlayerAvatar(externalId, { existingJobId: job.id });
        processed++;
      } catch (err) {
        console.warn(`[AvatarSync] Pending job for ${externalId} failed:`, err);
      }
    }

    return processed;
  }
}

export const avatarSyncService = new AvatarSyncService();
