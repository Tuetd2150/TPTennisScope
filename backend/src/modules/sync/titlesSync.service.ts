import { SyncService } from './sync.service';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { playerRepository } from '../players/player.repository';
import { syncRepository } from './sync.repository';
import {
  SyncJobType,
  SyncJobStatus,
} from '@prisma/client';
import { normalizePlayerTitles } from './normalizers';

export class TitlesSyncService extends SyncService {
  async syncPlayerTitles(externalId: number, existingJobId?: number) {
    if (!(await this.checkBudget())) {
      throw new Error('[TitlesSync] API budget exhausted, stopping titles sync');
    }

    const job = existingJobId
      ? { id: existingJobId }
      : await syncRepository.createJob(
          SyncJobType.PLAYER_TITLES,
          String(externalId)
        );

    await syncRepository.updateJob(job.id, {
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      const response =
        await tennisApiClient.getPlayerTitles(
          externalId
        );

      const titles =
        normalizePlayerTitles(response);

      const player =
        await playerRepository.findByExternalId(
          externalId
        );

      if (!player) {
        throw new Error(
          `Player ${externalId} not found`
        );
      }

      for (const title of titles) {
        await playerRepository.upsertTitle(
          player.id,
          title.tourRankId,
          {
            tourRankName:
              title.tourRankName,
            titlesWon:
              title.titlesWon,
            finalsLost:
              title.finalsLost,
          }
        );
      }

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
        errorMessage: null,
        requestsUsed: 1,
      });

      console.log(
        `[TitlesSync] Synced ${titles.length} title categories for ${player.name} (${externalId})`
      );

      return titles;
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
        `[TitlesSync] Failed ${externalId}:`,
        message
      );

      throw error;
    }
  }

  async processPendingTitles(limit: number = 10) {
    const jobs = await syncRepository.getPendingJobs(
      SyncJobType.PLAYER_TITLES,
      limit
    );

    for (const job of jobs) {
      if (!(await this.checkBudget())) {
        console.log(
          '[TitlesSync] API budget exhausted, stopping titles sync'
        );
        break;
      }

      if (!job.targetKey) {
        continue;
      }

      const externalId = Number(job.targetKey);

      if (!Number.isInteger(externalId)) {
        await syncRepository.updateJob(job.id, {
          status: SyncJobStatus.FAILED,
          errorMessage: 'Invalid player externalId',
          finishedAt: new Date(),
        });

        continue;
      }

      try {
        await this.syncPlayerTitles(externalId, job.id);
      } catch {
        // Individual failure logged inside syncPlayerTitles
      }
    }
  }
}

export const titlesSyncService =
  new TitlesSyncService();