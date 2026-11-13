import fs from 'fs';
import path from 'path';
import { SyncService } from './sync.service';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { playerRepository } from '../players/player.repository';
import { syncRepository } from './sync.repository';
import { prisma } from '../../config/database';
import {
  SyncJobType,
  SyncJobStatus,
} from '@prisma/client';
import {
  parseHandAndBackhand,
  parseHeight,
  parseWeight,
} from '../../utils/tennisStats';
import { normalizeCountryCode } from '../../utils/country';

export class ProfileSyncService extends SyncService {
  async syncPlayerProfile(
    externalId: number,
    options?: { fetchImage?: boolean; existingJobId?: number }
  ) {
    if (!(await this.checkBudget())) {
      throw new Error('[ProfileSync] API budget exhausted, stopping profile sync');
    }

    const job = options?.existingJobId
      ? { id: options.existingJobId }
      : await syncRepository.createJob(
          SyncJobType.PLAYER_PROFILE,
          String(externalId)
        );

    await syncRepository.updateJob(job.id, {
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any =
        await tennisApiClient.getPlayerProfile(externalId);

      const profile = response?.data;

      if (!profile?.id || !profile?.name) {
        throw new Error(
          `Invalid player profile response for ${externalId}`
        );
      }

      const information = profile.information ?? {};

      const { hand, backhand } =
        parseHandAndBackhand(
          information.plays ?? ''
        );

      const turnedProRaw =
        information.turnedPro;

      const turnedPro =
        turnedProRaw != null &&
        !Number.isNaN(Number(turnedProRaw))
          ? Number(turnedProRaw)
          : null;

      const careerHighDate =
        profile.bestRank?.date
          ? new Date(profile.bestRank.date)
          : null;

      // Image caching handling (only if explicitly enabled)
      let imagePath: string | null = null;
      const imageFileName = `${externalId}.png`;
      const localImagePath = path.join(__dirname, '..', '..', '..', 'storage', 'player-images', imageFileName);
      const publicImagePath = `/api/images/players/${imageFileName}`;

      if (fs.existsSync(localImagePath)) {
        imagePath = publicImagePath;
      } else if (options?.fetchImage && (profile.imagePath || profile.image)) {
        const remoteUrl = profile.imagePath || profile.image;
        if (await this.checkBudget()) {
          try {
            const imageBuffer = await tennisApiClient.getPlayerImage(remoteUrl);
            const dir = path.dirname(localImagePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(localImagePath, imageBuffer);
            imagePath = publicImagePath;
            console.log(`[ProfileSync] Cached image for ${profile.name} (${externalId})`);
          } catch {
            console.warn(`[ProfileSync] Image fetch failed or returned 404 for ${externalId}, using placeholder fallback`);
            imagePath = null;
          }
        }
      }

      const upserted = await playerRepository.upsertFullProfile(
        externalId,
        {
          externalId,
          name: profile.name,

          birthday: profile.birthday
            ? new Date(profile.birthday)
            : null,

          countryCode: normalizeCountryCode(
            profile.countryAcr ??
            profile.country?.acronym ??
            profile.country?.nameCode ??
            profile.country?.id
          ),

          turnedPro,

          heightCm: parseHeight(
            information.height ??
              profile.height
          ),

          weightKg: parseWeight(
            information.weight
          ),

          birthplace:
            information.birthplace ?? null,

          residence:
            information.residence ?? null,

          hand,
          backhand,

          coach:
            profile.coach ??
            information.coach ??
            null,

          status:
            profile.playerStatus ?? null,

          careerHighRank:
            profile.bestRank?.position ??
            null,

          careerHighDate,
          imagePath,
        }
      );

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
        errorMessage: null,
        requestsUsed: 1,
      });

      console.log(
        `[ProfileSync] Synced ${profile.name} (${externalId})`
      );

      return upserted;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.FAILED,
        errorMessage: message,
        finishedAt: new Date(),
      });

      console.error(
        `[ProfileSync] Failed ${externalId}:`,
        message
      );

      throw error;
    }
  }

  async processPendingProfiles(limit: number = 10) {
    const jobs = await syncRepository.getPendingJobs(
      SyncJobType.PLAYER_PROFILE,
      limit
    );

    for (const job of jobs) {
      if (!(await this.checkBudget())) {
        console.log(
          '[ProfileSync] API budget exhausted, stopping profile sync'
        );
        break;
      }

      if (!job.targetKey) {
        continue;
      }

      const externalId = parseInt(job.targetKey, 10);

      try {
        await this.syncPlayerProfile(externalId, {
          fetchImage: false,
          existingJobId: job.id,
        });
      } catch {
        // Individual failure logged inside syncPlayerProfile
      }
    }
  }

  /**
   * Reconciles missing countries for Current Top 100 players using RapidAPI Player Profile as authoritative fallback.
   * Strictly quota-aware: honors safetyBuffer, never exceeds daily budget, doesn't fetch images,
   * leaves remaining players pending for future batches.
   */
  async reconcileMissingTop100Countries(options?: {
    safetyBuffer?: number;
    maxProfiles?: number;
  }): Promise<{
    auditedMissing: number;
    processed: number;
    succeeded: number;
    stillMissing: number;
    remainingPending: number;
    requestsUsed: number;
  }> {
    const latestSnapshot = await prisma.rankingSnapshot.findFirst({
      orderBy: { rankingDate: 'desc' },
      select: { rankingDate: true },
    });

    if (!latestSnapshot) {
      console.log('[ProfileSync] No ranking snapshot found.');
      return { auditedMissing: 0, processed: 0, succeeded: 0, stillMissing: 0, remainingPending: 0, requestsUsed: 0 };
    }

    const missingPlayers = await prisma.player.findMany({
      where: {
        countryCode: null,
        rankings: {
          some: {
            rankingDate: latestSnapshot.rankingDate,
            rank: { lte: 100 },
          },
        },
      },
      select: { id: true, externalId: true, name: true },
      orderBy: { id: 'asc' },
    });

    const auditedMissing = missingPlayers.length;
    console.log(`[ProfileSync] Top 100 country reconciliation audit: ${auditedMissing} players currently have countryCode=null.`);

    if (auditedMissing === 0) {
      return { auditedMissing: 0, processed: 0, succeeded: 0, stillMissing: 0, remainingPending: 0, requestsUsed: 0 };
    }

    const safetyBuffer = options?.safetyBuffer ?? 6;
    const remainingBudget = await tennisApiClient.getRemainingBudget();
    const effectiveBudget = Math.max(0, remainingBudget - safetyBuffer);
    const maxToFetch = Math.min(
      auditedMissing,
      effectiveBudget,
      options?.maxProfiles ?? effectiveBudget
    );

    console.log(
      `[ProfileSync] Quota evaluation: remainingBudget=${remainingBudget}, safetyBuffer=${safetyBuffer}, effectiveBudget=${effectiveBudget}. Will fetch up to ${maxToFetch} profiles.`
    );

    if (maxToFetch <= 0) {
      console.log(`[ProfileSync] Budget preserved by safety buffer (${safetyBuffer}) or exhausted. Keeping ${auditedMissing} players pending.`);
      return {
        auditedMissing,
        processed: 0,
        succeeded: 0,
        stillMissing: auditedMissing,
        remainingPending: auditedMissing,
        requestsUsed: 0,
      };
    }

    const toProcess = missingPlayers.slice(0, maxToFetch);
    let succeeded = 0;
    let stillMissing = 0;
    let requestsUsed = 0;

    for (const player of toProcess) {
      if (!(await this.checkBudget())) {
        console.warn(`[ProfileSync] Budget guard triggered before processing ${player.name} (${player.externalId}). Stopping.`);
        break;
      }

      console.log(`[ProfileSync] Fetching Profile fallback for ${player.name} (${player.externalId})...`);
      try {
        const updated = await this.syncPlayerProfile(player.externalId, {
          fetchImage: false,
        });
        requestsUsed++;

        if (updated.countryCode) {
          succeeded++;
          console.log(`[ProfileSync] ✅ Reconciled country for ${player.name}: ${updated.countryCode}`);
        } else {
          stillMissing++;
          console.log(`[ProfileSync] ℹ️ Provider returned no country for ${player.name}; kept countryCode=null as valid provider state.`);
        }
      } catch (err) {
        console.error(`[ProfileSync] ❌ Failed to fetch profile for ${player.name} (${player.externalId}):`, err);
      }
    }

    const remainingPending = auditedMissing - succeeded;

    console.log(
      `[ProfileSync] Batch completed: processed=${requestsUsed}, succeededWithCountry=${succeeded}, stillNull=${stillMissing}, remainingPendingInTop100=${remainingPending}, requestsUsed=${requestsUsed}`
    );

    return {
      auditedMissing,
      processed: requestsUsed,
      succeeded,
      stillMissing,
      remainingPending,
      requestsUsed,
    };
  }

  /**
   * Reconciles missing birthdays/ages for Current Top 100 players using RapidAPI Player Profile as authoritative provider.
   * Strictly quota-aware: honors safetyBuffer, never exceeds daily budget, doesn't fetch images,
   * enqueues remaining players as PENDING jobs for future scheduler batches.
   */
  async reconcileMissingTop100Birthdays(options?: {
    safetyBuffer?: number;
    maxProfiles?: number;
  }): Promise<{
    auditedMissing: number;
    processed: number;
    succeededWithBirthday: number;
    stillMissing: number;
    remainingPending: number;
    requestsUsed: number;
  }> {
    const latestSnapshot = await prisma.rankingSnapshot.findFirst({
      orderBy: { rankingDate: 'desc' },
      select: { rankingDate: true },
    });

    if (!latestSnapshot) {
      console.log('[ProfileSync] No ranking snapshot found.');
      return { auditedMissing: 0, processed: 0, succeededWithBirthday: 0, stillMissing: 0, remainingPending: 0, requestsUsed: 0 };
    }

    const missingPlayers = await prisma.player.findMany({
      where: {
        birthday: null,
        rankings: {
          some: {
            rankingDate: latestSnapshot.rankingDate,
            rank: { lte: 100 },
          },
        },
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        rankings: {
          where: { rankingDate: latestSnapshot.rankingDate },
          select: { rank: true },
        },
      },
    });

    // Sort by current ranking ascending (Rank 1 -> 100) to populate top ranks first
    missingPlayers.sort((a, b) => {
      const rankA = a.rankings[0]?.rank ?? 999;
      const rankB = b.rankings[0]?.rank ?? 999;
      return rankA - rankB;
    });

    const auditedMissing = missingPlayers.length;
    console.log(`[ProfileSync] Top 100 birthday audit: ${auditedMissing} players currently have birthday=null.`);

    if (auditedMissing === 0) {
      return { auditedMissing: 0, processed: 0, succeededWithBirthday: 0, stillMissing: 0, remainingPending: 0, requestsUsed: 0 };
    }

    const safetyBuffer = options?.safetyBuffer ?? 6;
    const remainingBudget = await tennisApiClient.getRemainingBudget();
    const effectiveBudget = Math.max(0, remainingBudget - safetyBuffer);
    const maxToFetch = Math.min(
      auditedMissing,
      effectiveBudget,
      options?.maxProfiles ?? effectiveBudget
    );

    console.log(
      `[ProfileSync] Quota evaluation: remainingBudget=${remainingBudget}, safetyBuffer=${safetyBuffer}, effectiveBudget=${effectiveBudget}. Will fetch up to ${maxToFetch} profiles for birthdays.`
    );

    // Queue all missing players as PLAYER_PROFILE jobs (cooldown-safe)
    for (const p of missingPlayers) {
      await syncRepository.createJobIfNeeded(
        SyncJobType.PLAYER_PROFILE,
        p.externalId.toString(),
        { reason: 'MISSING_BIRTHDAY' },
        7
      );
    }

    if (maxToFetch <= 0) {
      console.log(`[ProfileSync] Budget preserved by safety buffer (${safetyBuffer}) or exhausted. Keeping all ${auditedMissing} players pending.`);
      return {
        auditedMissing,
        processed: 0,
        succeededWithBirthday: 0,
        stillMissing: auditedMissing,
        remainingPending: auditedMissing,
        requestsUsed: 0,
      };
    }

    const toProcess = missingPlayers.slice(0, maxToFetch);
    let succeededWithBirthday = 0;
    let stillMissing = 0;
    let requestsUsed = 0;

    for (const player of toProcess) {
      if (!(await this.checkBudget())) {
        console.warn(`[ProfileSync] Budget guard triggered before processing ${player.name} (${player.externalId}). Stopping.`);
        break;
      }

      console.log(`[ProfileSync] Fetching Profile for ${player.name} (${player.externalId}) to obtain birthday/age...`);
      try {
        const updated = await this.syncPlayerProfile(player.externalId, {
          fetchImage: false,
        });
        requestsUsed++;

        if (updated.birthday) {
          succeededWithBirthday++;
          console.log(`[ProfileSync] ✅ Reconciled birthday for ${player.name}: ${updated.birthday.toISOString().split('T')[0]}`);
        } else {
          stillMissing++;
          console.log(`[ProfileSync] ℹ️ Provider returned no birthday for ${player.name}; kept birthday=null as valid provider state.`);
        }
      } catch (err) {
        console.error(`[ProfileSync] ❌ Failed to fetch profile for ${player.name} (${player.externalId}):`, err);
      }
    }

    const remainingPending = auditedMissing - succeededWithBirthday;

    console.log(
      `[ProfileSync] Birthday batch completed: processed=${requestsUsed}, succeededWithBirthday=${succeededWithBirthday}, stillNull=${stillMissing}, remainingPendingInTop100=${remainingPending}, requestsUsed=${requestsUsed}`
    );

    return {
      auditedMissing,
      processed: requestsUsed,
      succeededWithBirthday,
      stillMissing,
      remainingPending,
      requestsUsed,
    };
  }
}

export const profileSyncService =
  new ProfileSyncService();