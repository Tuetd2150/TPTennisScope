import { prisma } from '../../config/database';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { matchRepository } from '../matches/match.repository';
import { tournamentRepository } from '../tournaments/tournament.repository';
import { playerRepository } from '../players/player.repository';
import { rankingRepository } from '../rankings/ranking.repository';
import { syncRepository } from './sync.repository';
import { SyncJobType, SyncJobStatus } from '@prisma/client';
import { isSinglesMatch, normalizeSurface } from '../../utils/tennisStats';
import { env } from '../../config/env';
import { normalizeMatchPlayerStats } from './normalizers';

export interface MatchSyncResult {
  processed: number;
  inserted: number;
  ignoredOutsideTop100: number;
  skipped: number;
  requestsUsed: number;
}

/**
 * OR Rule: A singles match is tracked if and only if
 * AT LEAST ONE of the participants belongs to the Current Top 100.
 */
export function shouldTrackSinglesMatch(
  player1ExternalId: number,
  player2ExternalId: number,
  currentTop100ExternalIds: Set<number>
): boolean {
  return (
    currentTop100ExternalIds.has(player1ExternalId) ||
    currentTop100ExternalIds.has(player2ExternalId)
  );
}

export class MatchSyncService {
  private async checkBudget(count: number = 1): Promise<boolean> {
    return tennisApiClient.hasBudget(count);
  }

  private getTodayDateString(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: env.SYNC_TIMEZONE || 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  async backfillPlayerSeason(
    playerExternalId: number,
    year: number = 2026,
    options?: { maxPages?: number }
  ) {
    const maxPages = options?.maxPages ?? 1;

    if (!(await this.checkBudget(1))) {
      console.log('[MatchSync] No API budget remaining for player season backfill');
      return { totalMatches: 0, newMatches: 0, requestsUsed: 0, hasNextPage: false };
    }

    const targetKey = `${playerExternalId}:${year}`;
    const job = await syncRepository.createJob(SyncJobType.BACKFILL, targetKey);
    await syncRepository.updateJob(job.id, { status: SyncJobStatus.RUNNING, startedAt: new Date() });

    try {
      const existingTarget = await playerRepository.findByExternalId(playerExternalId);
      if (!existingTarget) {
        await playerRepository.upsertFromExternal(playerExternalId, {
          externalId: playerExternalId,
          name: `Player ${playerExternalId}`,
        });
      }

      let pageNo = 1;
      let hasNextPage = true;
      let totalMatchesProcessed = 0;
      let totalMatchesInserted = 0;
      let actualRequestsCount = 0;

      while (hasNextPage) {
        if (!(await this.checkBudget())) {
          console.log('[MatchSync] Budget exhausted during past-matches pagination');
          break;
        }

        if (actualRequestsCount >= maxPages) {
          if (hasNextPage) {
            console.warn(`[MatchSync] Past-matches pagination available, but stopped after ${actualRequestsCount} page(s) due to maxPages limit`);
          }
          break;
        }

        actualRequestsCount++;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response: any = await tennisApiClient.getPlayerPastMatches(playerExternalId, {
          year,
          pageNo,
          pageSize: 500,
          include: 'round,tournament,tournament.court,stat',
        });

        const matches = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.results)
          ? response.results
          : Array.isArray(response?.data?.results)
          ? response.data.results
          : Array.isArray(response?.matches)
          ? response.matches
          : [];

        hasNextPage = response?.hasNextPage === true || response?.data?.hasNextPage === true;

        console.log(`[MatchSync] Past-matches API returned ${matches.length} matches for player ${playerExternalId} (year ${year})`);

        for (const item of matches) {
          totalMatchesProcessed++;

          const p1Raw = item.player1 || item.p1;
          const p2Raw = item.player2 || item.p2;

          if (!p1Raw?.id || !p2Raw?.id) {
            continue;
          }

          const p1Name = p1Raw.name || '';
          const p2Name = p2Raw.name || '';

          if (!isSinglesMatch(p1Name, p2Name)) {
            continue;
          }

          const externalMatchId = Number(item.matchId || item.id);
          if (!externalMatchId || Number.isNaN(externalMatchId)) {
            continue;
          }

          const p1ExternalId = Number(p1Raw.id);
          const p2ExternalId = Number(p2Raw.id);

          const p1 = await playerRepository.upsertFromExternal(p1ExternalId, {
            externalId: p1ExternalId,
            name: p1Name,
            countryCode: p1Raw.country?.id || p1Raw.country?.nameCode || p1Raw.countryAcr || null,
          });

          const p2 = await playerRepository.upsertFromExternal(p2ExternalId, {
            externalId: p2ExternalId,
            name: p2Name,
            countryCode: p2Raw.country?.id || p2Raw.country?.nameCode || p2Raw.countryAcr || null,
          });

          let tournamentDbId: number | undefined;
          const tourObj = item.tournament || item.event;
          if (tourObj?.id) {
            const tourExternalId = Number(tourObj.id);
            const tourName = tourObj.name || 'Unknown Tournament';
            const rawSurf = tourObj.courtId ?? tourObj.surface ?? tourObj.court ?? tourObj.courtName ?? tourObj.courtType;
            const normalizedSurf = normalizeSurface(rawSurf, tourName);

            const tour = await tournamentRepository.upsertTournament(tourExternalId, {
              externalId: tourExternalId,
              name: tourName,
              surface: normalizedSurf,
              courtId: tourObj.courtId ? Number(tourObj.courtId) : null,
              countryCode: tourObj.country?.id || tourObj.country?.nameCode || tourObj.countryAcr || null,
              levelId: tourObj.levelId ? Number(tourObj.levelId) : null,
              levelName: tourObj.levelName || null,
            });
            tournamentDbId = tour.id;
          }

          let winnerExternalId: number;
          let loserExternalId: number;

          const rawWinnerId = item.winner_id ?? item.winnerId ?? item.match_winner ?? item.winner?.id;
          if (rawWinnerId != null) {
            winnerExternalId = Number(rawWinnerId);
            loserExternalId = winnerExternalId === p1ExternalId ? p2ExternalId : p1ExternalId;
          } else {
            winnerExternalId = p1ExternalId;
            loserExternalId = p2ExternalId;
          }

          const winnerId = winnerExternalId === p1ExternalId ? p1.id : p2.id;
          const loserId = loserExternalId === p1ExternalId ? p1.id : p2.id;

          const score = item.result || item.score || null;
          const status = item.result_type || item.status || null;
          const bestOf = item.best_of ? Number(item.best_of) : null;
          const matchDate = item.date ? new Date(item.date) : new Date(`${year}-01-01`);
          const roundId = item.roundId ? Number(item.roundId) : (item.round?.id ? Number(item.round.id) : null);
          const roundName = item.roundName || item.round?.name || null;

          const match = await matchRepository.upsertMatch(externalMatchId, {
            externalMatchId,
            tournament: tournamentDbId ? { connect: { id: tournamentDbId } } : undefined,
            matchDate,
            roundId,
            roundName,
            player1: { connect: { id: p1.id } },
            player2: { connect: { id: p2.id } },
            winner: { connect: { id: winnerId } },
            loser: { connect: { id: loserId } },
            score,
            status,
            bestOf,
          });

          totalMatchesInserted++;

          // Embedded match stats extraction if present
          const statsContainer = item.stat || item.stats || item.statistics || item.playerStats;
          const p1StatsRaw = item.player1Stats || statsContainer?.player1 || (Array.isArray(statsContainer) ? statsContainer[0] : null);
          const p2StatsRaw = item.player2Stats || statsContainer?.player2 || (Array.isArray(statsContainer) ? statsContainer[1] : null);

          if (p1StatsRaw) {
            const norm1 = normalizeMatchPlayerStats(p1StatsRaw, p2StatsRaw);
            if (norm1) {
              await matchRepository.upsertMatchPlayerStat(match.id, p1.id, norm1);
            }
          }

          if (p2StatsRaw) {
            const norm2 = normalizeMatchPlayerStats(p2StatsRaw, p1StatsRaw);
            if (norm2) {
              await matchRepository.upsertMatchPlayerStat(match.id, p2.id, norm2);
            }
          }
        }

        pageNo++;
      }

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
        requestsUsed: actualRequestsCount,
      });

      console.log(`[MatchSync] Backfill completed for player ${playerExternalId} (${year}): processed=${totalMatchesProcessed}, inserted/updated=${totalMatchesInserted}, requestsUsed=${actualRequestsCount}`);
      return {
        totalMatches: totalMatchesProcessed,
        newMatches: totalMatchesInserted,
        requestsUsed: actualRequestsCount,
        hasNextPage: Boolean(hasNextPage && actualRequestsCount >= maxPages),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[MatchSync] Backfill failed for player ${playerExternalId}:`, message);
      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.FAILED,
        errorMessage: message,
        finishedAt: new Date(),
      });
      throw error;
    }
  }

  async sync(date?: string, customResultsData?: unknown): Promise<MatchSyncResult | undefined> {
    const targetDate = date || this.getTodayDateString();
    
    if (!customResultsData && !(await this.checkBudget())) {
      console.log('[MatchSync] No API budget remaining, skipping sync');
      return;
    }

    const job = await syncRepository.createJob(SyncJobType.MATCH_RESULTS, targetDate);
    await syncRepository.updateJob(job.id, { status: SyncJobStatus.RUNNING, startedAt: new Date() });

    try {
      // 1. Load current Top 100 external IDs dynamically from DB
      const currentTop100ExternalIds = await rankingRepository.getCurrentTop100ExternalIds();
      console.log(`[MatchSync] Loaded ${currentTop100ExternalIds.size} current Top 100 players from database`);

      let pageNo = 1;
      let hasNextPage = true;
      let totalProcessed = 0;
      let totalSkipped = 0;
      let totalInserted = 0;
      let totalIgnoredOutsideTop100 = 0;
      let actualRequestsCount = 0;

      while (hasNextPage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let results: any[] = [];

        if (customResultsData) {
          // Custom / fixture data mode (no external provider request)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: any = customResultsData;
          results = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.data?.results)
            ? data.data.results
            : Array.isArray(data)
            ? data
            : [];
          hasNextPage = false;
        } else {
          if (!(await this.checkBudget())) {
            console.log('[MatchSync] Budget exhausted during pagination');
            break;
          }

          actualRequestsCount++;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response: any = await tennisApiClient.getResults(targetDate, pageNo, 500);

          results = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.results)
            ? response.results
            : Array.isArray(response?.data?.results)
            ? response.data.results
            : [];

          hasNextPage = response?.hasNextPage === true || response?.data?.hasNextPage === true;
          if (!customResultsData && hasNextPage) {
            console.warn('[MatchSync] Additional page exists but stopping pagination to strictly enforce quota limit (1 request max).');
            hasNextPage = false;
          }
        }

        for (const result of results) {
          totalProcessed++;

          if (!result.player1 || !result.player2) {
            totalSkipped++;
            continue;
          }

          const p1Name = result.player1.name || '';
          const p2Name = result.player2.name || '';
          if (!isSinglesMatch(p1Name, p2Name)) {
            totalSkipped++;
            continue;
          }

          const externalMatchId = Number(result.matchId || result.id);
          if (!externalMatchId || Number.isNaN(externalMatchId)) {
            totalSkipped++;
            continue;
          }

          const p1ExternalId = Number(result.player1.id);
          const p2ExternalId = Number(result.player2.id);

          // OR RULE: Keep match if AT LEAST ONE player belongs to Current Top 100
          if (!shouldTrackSinglesMatch(p1ExternalId, p2ExternalId, currentTop100ExternalIds)) {
            totalIgnoredOutsideTop100++;
            continue;
          }

          // Opponents outside Top 100 are created/reused as minimal profiles without full enrichment
          const p1 = await playerRepository.upsertFromExternal(p1ExternalId, {
            externalId: p1ExternalId,
            name: p1Name,
            countryCode: result.player1.country?.id || result.player1.country?.nameCode || null,
          });

          const p2 = await playerRepository.upsertFromExternal(p2ExternalId, {
            externalId: p2ExternalId,
            name: p2Name,
            countryCode: result.player2.country?.id || result.player2.country?.nameCode || null,
          });

          let tournamentDbId: number | undefined;
          const tourObj = result.tournament;
          if (tourObj?.id) {
            const tourExternalId = Number(tourObj.id);
            const tourName = tourObj.name || 'Unknown Tournament';
            const rawSurf = tourObj.courtId ?? tourObj.surface ?? tourObj.court ?? tourObj.courtName ?? tourObj.courtType;
            const normalizedSurf = normalizeSurface(rawSurf, tourName);

            const tour = await tournamentRepository.upsertTournament(tourExternalId, {
              externalId: tourExternalId,
              name: tourName,
              surface: normalizedSurf,
              courtId: tourObj.courtId ? Number(tourObj.courtId) : null,
              countryCode: tourObj.country?.id || tourObj.country?.nameCode || null,
              levelId: tourObj.levelId ? Number(tourObj.levelId) : null,
              levelName: tourObj.levelName || null,
            });
            tournamentDbId = tour.id;
          }

          let winnerExternalId: number;
          let loserExternalId: number;

          const rawWinnerId = result.winner_id ?? result.winnerId ?? result.match_winner ?? result.winner?.id;
          if (rawWinnerId != null) {
            winnerExternalId = Number(rawWinnerId);
            loserExternalId = winnerExternalId === p1ExternalId ? p2ExternalId : p1ExternalId;
          } else {
            winnerExternalId = p1ExternalId;
            loserExternalId = p2ExternalId;
          }

          const winnerId = winnerExternalId === p1ExternalId ? p1.id : p2.id;
          const loserId = loserExternalId === p1ExternalId ? p1.id : p2.id;

          const score = result.result || result.score || null;
          const status = result.result_type || result.status || null;
          const bestOf = result.best_of ? Number(result.best_of) : null;
          const matchDate = result.date ? new Date(result.date) : new Date(targetDate);

          // Idempotent upsert: converges whether incoming from results or backfill
          const match = await matchRepository.upsertMatch(externalMatchId, {
            externalMatchId,
            tournament: tournamentDbId ? { connect: { id: tournamentDbId } } : undefined,
            matchDate,
            roundId: result.roundId ? Number(result.roundId) : null,
            roundName: result.roundName || null,
            player1: { connect: { id: p1.id } },
            player2: { connect: { id: p2.id } },
            winner: { connect: { id: winnerId } },
            loser: { connect: { id: loserId } },
            score,
            status,
            bestOf,
          });

          totalInserted++;

          // Embedded match stats extraction if present in results
          const statsContainer = result.stat || result.stats || result.statistics || result.playerStats;
          const p1StatsRaw = result.player1Stats || statsContainer?.player1 || (Array.isArray(statsContainer) ? statsContainer[0] : null);
          const p2StatsRaw = result.player2Stats || statsContainer?.player2 || (Array.isArray(statsContainer) ? statsContainer[1] : null);

          if (p1StatsRaw) {
            const norm1 = normalizeMatchPlayerStats(p1StatsRaw, p2StatsRaw);
            if (norm1) {
              await matchRepository.upsertMatchPlayerStat(match.id, p1.id, norm1);
            }
          }

          if (p2StatsRaw) {
            const norm2 = normalizeMatchPlayerStats(p2StatsRaw, p1StatsRaw);
            if (norm2) {
              await matchRepository.upsertMatchPlayerStat(match.id, p2.id, norm2);
            }
          }

          if (tourObj?.id && !p1StatsRaw && !p2StatsRaw) {
            await syncRepository.createJobIfNeeded(
              SyncJobType.MATCH_STATS,
              `${externalMatchId}`,
              {
                matchDbId: match.id,
                tournamentExternalId: Number(tourObj.id),
                player1ExternalId: p1ExternalId,
                player2ExternalId: p2ExternalId,
                player1DbId: p1.id,
                player2DbId: p2.id,
              },
              30
            );
          }
        }

        pageNo++;
      }

      console.log(`[MatchSync] Completed: processed=${totalProcessed}, inserted=${totalInserted}, ignoredOutsideTop100=${totalIgnoredOutsideTop100}, skipped=${totalSkipped}, requestsUsed=${actualRequestsCount}`);
      await syncRepository.updateJob(job.id, { 
        status: SyncJobStatus.COMPLETED, 
        finishedAt: new Date(),
        requestsUsed: actualRequestsCount,
      });

      return {
        processed: totalProcessed,
        inserted: totalInserted,
        ignoredOutsideTop100: totalIgnoredOutsideTop100,
        skipped: totalSkipped,
        requestsUsed: actualRequestsCount,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[MatchSync] Failed:', message);
      await syncRepository.updateJob(job.id, { 
        status: SyncJobStatus.FAILED, 
        errorMessage: message,
        finishedAt: new Date(),
      });
      throw error;
    }
  }

  async processPendingMatchStats(limit: number = 5) {
    const jobs = await prisma.syncJob.findMany({
      where: {
        type: SyncJobType.MATCH_STATS,
        status: { in: [SyncJobStatus.PENDING, SyncJobStatus.FAILED] },
      },
      take: limit,
    });

    for (const job of jobs) {
      if (!(await this.checkBudget())) {
        console.log('[MatchSync] API budget exhausted, stopping match stats sync');
        break;
      }

      const payload = job.payload as {
        matchDbId: number;
        tournamentExternalId: number;
        player1ExternalId: number;
        player2ExternalId: number;
        player1DbId: number;
        player2DbId: number;
      } | null;

      if (!payload) {
        await syncRepository.updateJob(job.id, {
          status: SyncJobStatus.FAILED,
          errorMessage: 'Missing payload for MATCH_STATS job',
          finishedAt: new Date(),
        });
        continue;
      }

      await syncRepository.updateJob(job.id, {
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response: any = await tennisApiClient.getMatchStats(
          payload.tournamentExternalId,
          payload.player1ExternalId,
          payload.player2ExternalId
        );

        const data = response?.data || response;
        const player1Raw = data?.player1 || data?.player1Stats || data?.stats?.player1 || data?.statistics?.player1;
        const player2Raw = data?.player2 || data?.player2Stats || data?.stats?.player2 || data?.statistics?.player2;

        const p1Normalized = normalizeMatchPlayerStats(player1Raw);
        const p2Normalized = normalizeMatchPlayerStats(player2Raw);

        if (p1Normalized) {
          await matchRepository.upsertMatchPlayerStat(payload.matchDbId, payload.player1DbId, p1Normalized);
        }

        if (p2Normalized) {
          await matchRepository.upsertMatchPlayerStat(payload.matchDbId, payload.player2DbId, p2Normalized);
        }

        await syncRepository.updateJob(job.id, {
          status: SyncJobStatus.COMPLETED,
          finishedAt: new Date(),
          requestsUsed: 1,
        });

        console.log(`[MatchSync] Synced stats for match ${payload.matchDbId}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[MatchSync] Failed stats for match ${payload.matchDbId}:`, message);
        await syncRepository.updateJob(job.id, {
          status: SyncJobStatus.FAILED,
          errorMessage: message,
          finishedAt: new Date(),
        });
      }
    }
  }

  async syncWithReconciliation() {
    await this.sync();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: env.SYNC_TIMEZONE || 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(yesterday);

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;

    const yesterdayStr = `${year}-${month}-${day}`;
    await this.sync(yesterdayStr);
  }
}

export const matchSyncService = new MatchSyncService();
