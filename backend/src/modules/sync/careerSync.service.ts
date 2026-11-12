import { SyncService } from './sync.service';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { playerRepository } from '../players/player.repository';
import { syncRepository } from './sync.repository';
import {
  SyncJobType,
  SyncJobStatus,
} from '@prisma/client';
import { normalizeCareerStats } from './normalizers';

export class CareerSyncService extends SyncService {
  async syncPlayerCareer(externalId: number, existingJobId?: number) {
    if (!(await this.checkBudget())) {
      throw new Error('[CareerSync] API budget exhausted, stopping career sync');
    }

    const job = existingJobId
      ? { id: existingJobId }
      : await syncRepository.createJob(
          SyncJobType.PLAYER_CAREER,
          String(externalId)
        );

    await syncRepository.updateJob(job.id, {
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      const response =
        await tennisApiClient.getPlayerCareerStats(
          externalId
        );

      const stats = normalizeCareerStats(response);

      const player =
        await playerRepository.findByExternalId(
          externalId
        );

      if (!player) {
        throw new Error(
          `Player ${externalId} not found`
        );
      }

      await playerRepository.upsertCareerStat(
        player.id,
        {
          careerWins: stats.careerWins,
          careerLosses: stats.careerLosses,
          favouriteSurface:
            stats.favouriteSurface,
          careerFinals: stats.careerFinals,
          careerTitles: stats.careerTitles,
          careerRunnerUps:
            stats.careerRunnerUps,
        }
      );

      if (stats.careerHighRank != null) {
        await playerRepository.updateCareerHigh(
          externalId,
          stats.careerHighRank,
          stats.careerHighDate
        );
      }

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
        errorMessage: null,
        requestsUsed: 1,
      });

      console.log(
        `[CareerSync] Synced career stats for ${player.name} (${externalId})`
      );

      return stats;
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
        `[CareerSync] Failed ${externalId}:`,
        message
      );

      throw error;
    }
  }

  async processPendingCareers(limit: number = 10) {
    const jobs = await syncRepository.getPendingJobs(
      SyncJobType.PLAYER_CAREER,
      limit
    );

    for (const job of jobs) {
      if (!(await this.checkBudget())) {
        console.log(
          '[CareerSync] API budget exhausted, stopping career sync'
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
        await this.syncPlayerCareer(externalId, job.id);
      } catch {
        // Individual failure logged inside syncPlayerCareer
      }
    }
  }
}

export const careerSyncService =
  new CareerSyncService();