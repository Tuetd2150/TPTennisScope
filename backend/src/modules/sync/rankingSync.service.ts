import { SyncService } from './sync.service';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { rankingRepository } from '../rankings/ranking.repository';
import { playerRepository } from '../players/player.repository';
import { syncRepository } from './sync.repository';
import { prisma } from '../../config/database';
import { SyncJobType, SyncJobStatus } from '@prisma/client';
import { normalizeCountryCode } from '../../utils/country';

export interface RankingMembershipChange {
  entered: number[]; // externalIds of players entering Top 100
  stayed: number[];  // externalIds of players staying in Top 100
  left: number[];    // externalIds of players leaving Top 100
}

export interface RankingSyncResult {
  rankingDate: Date;
  totalSynced: number;
  changes: RankingMembershipChange;
}

/**
 * Computes dynamic Top 100 membership transitions:
 * - ENTERED: in new Top 100 but not in previous Top 100
 * - STAYED: in both previous and new Top 100
 * - LEFT: in previous Top 100 but no longer in new Top 100
 */
export function computeTop100MembershipChanges(
  previousExternalIds: Iterable<number>,
  newExternalIds: Iterable<number>
): RankingMembershipChange {
  const prevSet = new Set(previousExternalIds);
  const newSet = new Set(newExternalIds);

  const entered: number[] = [];
  const stayed: number[] = [];
  const left: number[] = [];

  for (const id of newSet) {
    if (prevSet.has(id)) {
      stayed.push(id);
    } else {
      entered.push(id);
    }
  }

  for (const id of prevSet) {
    if (!newSet.has(id)) {
      left.push(id);
    }
  }

  return { entered, stayed, left };
}

export class RankingSyncService extends SyncService {
  /**
   * Performs dynamic ATP Top 100 ranking sync.
   * If customRankingsData is supplied, uses it directly without calling external provider (useful for testing/fixtures).
   */
  async sync(customRankingsData?: unknown): Promise<RankingSyncResult | undefined> {
    if (!customRankingsData && !(await this.checkBudget())) {
      console.log('[RankingSync] Daily API budget exhausted.');
      return;
    }

    const job = await syncRepository.createJob(SyncJobType.RANKING);

    await syncRepository.updateJob(job.id, {
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      // 1. Fetch ranking data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rankingsData: any = customRankingsData || (await tennisApiClient.getRankings());
      const rankings = rankingsData?.data || rankingsData?.rankings;

      if (!Array.isArray(rankings) || rankings.length === 0) {
        throw new Error('Ranking API returned no ranking data.');
      }

      console.log(`[RankingSync] Processing ${rankings.length} rankings`);

      // 2. Derive previous Top 100 external IDs from DB before updating
      const previousTop100ExternalIds = await rankingRepository.getCurrentTop100ExternalIds();

      // 3. Filter valid top 100 items (rank <= 100)
      const validRankings = rankings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => {
          const playerId = item?.player?.id ?? item?.playerId;
          const playerName = item?.player?.name ?? item?.name;
          const pos = item?.position ?? item?.rank;
          const point = item?.point ?? item?.points;
          const date = item?.date ?? item?.rankingDate ?? rankingsData?.rankingDate;
          return playerId != null && playerName && pos != null && point != null && date;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => Number(item?.position ?? item?.rank) <= 100);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newTop100ExternalIds = new Set<number>(validRankings.map((item: any) => Number(item.player?.id ?? item.playerId)));

      // 4. Compute ENTER / STAY / LEAVE changes
      const changes = computeTop100MembershipChanges(previousTop100ExternalIds, newTop100ExternalIds);
      const enteredSet = new Set(changes.entered);
      const stayedSet = new Set(changes.stayed);

      let syncedCount = 0;
      let rankingPayloadCountryCount = 0;
      let rankingDate = new Date();

      for (const item of validRankings) {
        const externalId = Number(item.player?.id ?? item.playerId);
        const name = String(item.player?.name ?? item.name);
        const position = Number(item.position ?? item.rank);
        const points = Number(item.point ?? item.points);
        const dateStr = item.date ?? item.rankingDate ?? rankingsData?.rankingDate;
        rankingDate = new Date(dateStr);

        const rawCountry =
          item.player?.countryAcr ??
          item.player?.country?.acronym ??
          item.player?.country?.nameCode ??
          item.player?.country?.id ??
          item.countryAcr ??
          item.country?.acronym ??
          item.country?.nameCode ??
          item.country?.id ??
          null;
        const countryCode = normalizeCountryCode(rawCountry);
        if (countryCode) {
          rankingPayloadCountryCount++;
        }

        // Precedence #1: Upsert / reuse player identity from authoritative Ranking payload
        const player = await playerRepository.upsertFromRanking(
          externalId,
          {
            name,
            countryCode,
          }
        );

        // Upsert RankingSnapshot (unique on playerId_rankingDate)
        await rankingRepository.upsertRanking({
          player: {
            connect: {
              id: player.id,
            },
          },
          rankingDate,
          rank: position,
          points,
        });

        // If player ENTERED: queue profile and backfill jobs if needed
        if (enteredSet.has(externalId)) {
          console.log(`[RankingSync] Player ${player.name} (${externalId}) ENTERED Top 100 at rank #${position}`);
          await syncRepository.createJobIfNeeded(
            SyncJobType.PLAYER_PROFILE,
            player.externalId.toString(),
            undefined,
            30
          );
          // Queue avatar sync job for newly entered player
          await syncRepository.createJobIfNeeded(
            SyncJobType.PLAYER_IMAGE,
            player.externalId.toString(),
            { rank: position, name: player.name },
            30
          );
        } else if (stayedSet.has(externalId)) {
          // If player STAYED: queue profile refresh only with reasonable cooldown
          await syncRepository.createJobIfNeeded(
            SyncJobType.PLAYER_PROFILE,
            player.externalId.toString(),
            undefined,
            30
          );
        }

        syncedCount++;
      }

      // 5. Track players who LEFT Top 100
      for (const leftExternalId of changes.left) {
        console.log(`[RankingSync] Player (${leftExternalId}) LEFT Top 100. Retaining all historical data.`);
      }

      if (syncedCount === 0) {
        throw new Error('Ranking sync completed with 0 valid players.');
      }

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
      });

      console.log(
        `[RankingSync] Successfully synced ${syncedCount} players. Changes: entered=${changes.entered.length}, stayed=${changes.stayed.length}, left=${changes.left.length}`
      );
      console.log(
        `[RankingSync] Country coverage from ranking payload: ${rankingPayloadCountryCount}/${syncedCount}`
      );

      // Audit Current Top 100 for players still missing countryCode
      // Queue PLAYER_PROFILE job if missing country, cooldown-safe & duplicate-safe
      const missingCountryPlayers = await prisma.player.findMany({
        where: {
          countryCode: null,
          rankings: {
            some: {
              rankingDate,
              rank: { lte: 100 },
            },
          },
        },
        select: { externalId: true, name: true },
      });

      if (missingCountryPlayers.length > 0) {
        console.log(
          `[RankingSync] Audited ${missingCountryPlayers.length} Top 100 players missing countryCode. Ensuring profile reconciliation jobs are queued.`
        );
        for (const p of missingCountryPlayers) {
          await syncRepository.createJobIfNeeded(
            SyncJobType.PLAYER_PROFILE,
            p.externalId.toString(),
            { reason: 'MISSING_COUNTRY' },
            7
          );
        }
      }

      // Audit Current Top 100 for players missing birthday / profile
      const missingBirthdayPlayers = await prisma.player.findMany({
        where: {
          birthday: null,
          rankings: {
            some: {
              rankingDate,
              rank: { lte: 100 },
            },
          },
        },
        select: { externalId: true, name: true },
      });

      if (missingBirthdayPlayers.length > 0) {
        console.log(
          `[RankingSync] Audited ${missingBirthdayPlayers.length} Top 100 players missing birthday. Ensuring profile reconciliation jobs are queued.`
        );
        for (const p of missingBirthdayPlayers) {
          await syncRepository.createJobIfNeeded(
            SyncJobType.PLAYER_PROFILE,
            p.externalId.toString(),
            { reason: 'MISSING_BIRTHDAY' },
            7
          );
        }
      }

      // Note: Automatic avatar downloading for ENTERED players is paused/feature-gated
      // pending validation of a working remote avatar source. Jobs remain safely PENDING.

      return {
        rankingDate,
        totalSynced: syncedCount,
        changes,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.FAILED,
        errorMessage: message,
        finishedAt: new Date(),
      });

      console.error('[RankingSync] Failed:', error);
      throw error;
    }
  }
}

export const rankingSyncService = new RankingSyncService();