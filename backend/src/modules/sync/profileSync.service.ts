import fs from 'fs';
import path from 'path';
import { SyncService } from './sync.service';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { playerRepository } from '../players/player.repository';
import { syncRepository } from './sync.repository';
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
          fetchImage: true,
          existingJobId: job.id,
        });
      } catch {
        // Individual failure logged inside syncPlayerProfile
      }
    }
  }
}

export const profileSyncService =
  new ProfileSyncService();