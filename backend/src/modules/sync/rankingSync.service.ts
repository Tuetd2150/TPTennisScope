import { SyncService } from './sync.service';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { rankingRepository } from '../rankings/ranking.repository';
import { playerRepository } from '../players/player.repository';
import { syncRepository } from './sync.repository';
import { SyncJobType, SyncJobStatus } from '@prisma/client';

export class RankingSyncService extends SyncService {
  async sync() {
    if (!(await this.checkBudget())) {
      console.log('[RankingSync] Daily API budget exhausted.');
      return;
    }

    const job = await syncRepository.createJob(SyncJobType.RANKING);

    await syncRepository.updateJob(job.id, {
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      const rankingsData: any = await tennisApiClient.getRankings();

      const rankings = rankingsData?.data;

      if (!Array.isArray(rankings) || rankings.length === 0) {
        throw new Error('Ranking API returned no ranking data.');
      }

      console.log(`[RankingSync] Fetched ${rankings.length} rankings`);

      let syncedCount = 0;

      for (const item of rankings) {
        if (
          !item?.player?.id ||
          !item?.player?.name ||
          item?.position == null ||
          item?.point == null ||
          !item?.date
        ) {
          console.warn('[RankingSync] Skipping invalid ranking item');
          continue;
        }

        const player = await playerRepository.upsertFromExternal(
          item.player.id,
          {
            externalId: item.player.id,
            name: item.player.name,
          }
        );

        await rankingRepository.upsertRanking({
          player: {
            connect: {
              id: player.id,
            },
          },

          // Use the official ranking date returned by the API
          rankingDate: new Date(item.date),

          // Matchstat API field names
          rank: item.position,
          points: item.point,
        });

        await syncRepository.createJobIfNeeded(
          SyncJobType.PLAYER_PROFILE,
          player.externalId.toString(),
          undefined,
          30
        );

        syncedCount++;
      }

      if (syncedCount === 0) {
        throw new Error('Ranking sync completed with 0 valid players.');
      }

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
      });

      console.log(
        `[RankingSync] Successfully synced ${syncedCount} players and ranking snapshots`
      );
    } catch (error: any) {
      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.FAILED,
        errorMessage: error?.message ?? String(error),
        finishedAt: new Date(),
      });

      console.error('[RankingSync] Failed:', error);

      // Important: do not hide sync failures
      throw error;
    }
  }
}

export const rankingSyncService = new RankingSyncService();