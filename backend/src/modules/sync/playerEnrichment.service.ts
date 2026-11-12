import { prisma } from '../../config/database';
import { tennisApiClient } from '../../clients/tennisApi.client';
import { profileSyncService } from './profileSync.service';
import { careerSyncService } from './careerSync.service';
import { titlesSyncService } from './titlesSync.service';
import { matchSyncService } from './matchSync.service';
import { playerService } from '../players/player.service';

export interface Top100AuditResult {
  rankingDate: Date | null;
  totalPlayers: number;
  missingProfile: number;
  missingCareer: number;
  missingTitles: number;
  zeroMatches2026: number;
  matchesUnder10: number;
  quotaEstimate: {
    profileRequests: number;
    careerRequests: number;
    titlesRequests: number;
    pastMatchesRequests: number;
    totalConservativeRequests: number;
  };
}

export interface PlayerAuditState {
  player: {
    id: number;
    externalId: number;
    name: string;
    birthday: Date | null;
    countryCode: string | null;
    turnedPro: number | null;
    heightCm: number | null;
    weightKg: number | null;
    coach: string | null;
    hand: string;
    backhand: string;
  };
  rank: number | null;
  points: number | null;
  rankingDate: Date | null;
  hasProfileComplete: boolean;
  hasCareer: boolean;
  careerStats: {
    careerWins: number | null;
    careerLosses: number | null;
    careerTitles: number | null;
    careerFinals: number | null;
    favouriteSurface: string | null;
  } | null;
  titlesCount: number;
  titlesBreakdown: Array<{
    tourRankId: number;
    tourRankName: string;
    titlesWon: number;
    finalsLost: number;
  }>;
  matches2026Count: number;
  stats2026Count: number;
  missingData: {
    profile: boolean;
    career: boolean;
    titles: boolean;
    season2026: boolean;
  };
}

export interface EnrichmentOptions {
  maxRequests?: number;
  skipIfComplete?: boolean;
  forceProfile?: boolean;
  forceCareer?: boolean;
  forceTitles?: boolean;
  forcePastMatches?: boolean;
  year?: number;
}

export interface EnrichmentResult {
  target: {
    rank: number | null;
    name: string;
    internalId: number;
    externalId: number;
    points: number | null;
    rankingDate: Date | null;
  };
  before: {
    hasProfile: boolean;
    hasCareer: boolean;
    titlesCount: number;
    matches2026: number;
    stats2026: number;
  };
  requestsUsed: {
    profile: number;
    career: number;
    titles: number;
    pastMatches: number;
    total: number;
  };
  endpointsCalled: Array<{
    endpoint: string;
    description: string;
    requests: number;
  }>;
  paginationRequired: boolean;
  after: {
    profileUpdated: boolean;
    careerStats: unknown;
    titlesBreakdown: unknown[];
    season2026Matches: number;
    season2026Stats: number;
    statCoveragePct: number;
    seasonAggregates: unknown;
  };
}

export class PlayerEnrichmentService {
  /**
   * Audit the Current Top 100 from the latest authoritative RankingSnapshot in PostgreSQL.
   * Does NOT make any network/provider calls.
   */
  async auditCurrentTop100(): Promise<Top100AuditResult> {
    const latestSnapshot = await prisma.rankingSnapshot.findFirst({
      orderBy: { rankingDate: 'desc' },
      select: { rankingDate: true },
    });

    if (!latestSnapshot) {
      return {
        rankingDate: null,
        totalPlayers: 0,
        missingProfile: 0,
        missingCareer: 0,
        missingTitles: 0,
        zeroMatches2026: 0,
        matchesUnder10: 0,
        quotaEstimate: {
          profileRequests: 0,
          careerRequests: 0,
          titlesRequests: 0,
          pastMatchesRequests: 0,
          totalConservativeRequests: 0,
        },
      };
    }

    const rankingDate = latestSnapshot.rankingDate;

    const top100 = await prisma.rankingSnapshot.findMany({
      where: { rankingDate, rank: { lte: 100 } },
      orderBy: { rank: 'asc' },
      include: {
        player: {
          include: {
            careerStat: true,
            titles: true,
            matchesAsPlayer1: {
              where: {
                matchDate: {
                  gte: new Date('2026-01-01'),
                  lte: new Date('2026-12-31T23:59:59.999Z'),
                },
              },
              select: { id: true },
            },
            matchesAsPlayer2: {
              where: {
                matchDate: {
                  gte: new Date('2026-01-01'),
                  lte: new Date('2026-12-31T23:59:59.999Z'),
                },
              },
              select: { id: true },
            },
          },
        },
      },
    });

    let missingProfile = 0;
    let missingCareer = 0;
    let missingTitles = 0;
    let zeroMatches2026 = 0;
    let matchesUnder10 = 0;

    for (const item of top100) {
      const p = item.player;
      const isProfileComplete = Boolean(
        p.birthday && p.countryCode && p.turnedPro
      );
      const hasCareer = Boolean(p.careerStat);
      const hasTitles = p.titles.length > 0;
      const matchCount =
        p.matchesAsPlayer1.length + p.matchesAsPlayer2.length;

      if (!isProfileComplete) missingProfile++;
      if (!hasCareer) missingCareer++;
      if (!hasTitles) missingTitles++;
      if (matchCount === 0) zeroMatches2026++;
      if (matchCount < 10) matchesUnder10++;
    }

    const totalConservative =
      missingProfile + missingCareer + missingTitles + top100.length;

    return {
      rankingDate,
      totalPlayers: top100.length,
      missingProfile,
      missingCareer,
      missingTitles,
      zeroMatches2026,
      matchesUnder10,
      quotaEstimate: {
        profileRequests: missingProfile,
        careerRequests: missingCareer,
        titlesRequests: missingTitles,
        pastMatchesRequests: top100.length,
        totalConservativeRequests: totalConservative,
      },
    };
  }

  /**
   * Dynamically resolves a player by rank from the latest authoritative RankingSnapshot in PostgreSQL.
   */
  async resolvePlayerByRank(rank: number = 1) {
    const latestSnapshot = await prisma.rankingSnapshot.findFirst({
      orderBy: { rankingDate: 'desc' },
      select: { rankingDate: true },
    });

    if (!latestSnapshot) {
      throw new Error('No ranking snapshots found in database');
    }

    const row = await prisma.rankingSnapshot.findFirst({
      where: {
        rankingDate: latestSnapshot.rankingDate,
        rank,
      },
      include: {
        player: true,
      },
    });

    if (!row) {
      throw new Error(
        `Player at rank #${rank} not found in latest snapshot (${latestSnapshot.rankingDate.toISOString()})`
      );
    }

    return {
      rank: row.rank,
      points: row.points,
      rankingDate: row.rankingDate,
      internalId: row.player.id,
      externalId: row.player.externalId,
      name: row.player.name,
    };
  }

  /**
   * Audits the current DB state for a player (profile, career, titles, 2026 season matches & stats).
   */
  async auditPlayer(
    externalId: number,
    year: number = 2026
  ): Promise<PlayerAuditState> {
    const player = await prisma.player.findUnique({
      where: { externalId },
      include: {
        careerStat: true,
        titles: {
          orderBy: { tourRankId: 'asc' },
        },
        matchesAsPlayer1: {
          where: {
            matchDate: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31T23:59:59.999Z`),
            },
          },
          include: {
            playerStats: {
              where: { player: { externalId } },
            },
          },
        },
        matchesAsPlayer2: {
          where: {
            matchDate: {
              gte: new Date(`${year}-01-01`),
              lte: new Date(`${year}-12-31T23:59:59.999Z`),
            },
          },
          include: {
            playerStats: {
              where: { player: { externalId } },
            },
          },
        },
        rankings: {
          orderBy: { rankingDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!player) {
      throw new Error(`Player with externalId ${externalId} not found in DB`);
    }

    const latestRanking = player.rankings[0] || null;

    const allMatches = [
      ...player.matchesAsPlayer1,
      ...player.matchesAsPlayer2,
    ];

    let statsCount = 0;
    for (const m of allMatches) {
      if (m.playerStats && m.playerStats.length > 0) {
        statsCount++;
      }
    }

    const hasProfileComplete = Boolean(
      player.birthday && player.countryCode && player.turnedPro
    );

    const hasCareer = Boolean(player.careerStat);
    const titlesCount = player.titles.length;
    const matches2026Count = allMatches.length;

    return {
      player: {
        id: player.id,
        externalId: player.externalId,
        name: player.name,
        birthday: player.birthday,
        countryCode: player.countryCode,
        turnedPro: player.turnedPro,
        heightCm: player.heightCm,
        weightKg: player.weightKg,
        coach: player.coach,
        hand: player.hand,
        backhand: player.backhand,
      },
      rank: latestRanking?.rank ?? null,
      points: latestRanking?.points ?? null,
      rankingDate: latestRanking?.rankingDate ?? null,
      hasProfileComplete,
      hasCareer,
      careerStats: player.careerStat
        ? {
            careerWins: player.careerStat.careerWins,
            careerLosses: player.careerStat.careerLosses,
            careerTitles: player.careerStat.careerTitles,
            careerFinals: player.careerStat.careerFinals,
            favouriteSurface: player.careerStat.favouriteSurface,
          }
        : null,
      titlesCount,
      titlesBreakdown: player.titles.map((t) => ({
        tourRankId: t.tourRankId,
        tourRankName: t.tourRankName,
        titlesWon: t.titlesWon,
        finalsLost: t.finalsLost,
      })),
      matches2026Count,
      stats2026Count: statsCount,
      missingData: {
        profile: !hasProfileComplete,
        career: !hasCareer,
        titles: titlesCount === 0,
        season2026: matches2026Count < 10,
      },
    };
  }

  /**
   * Controlled live enrichment for a target player.
   * Respects hard request cap (default <= 4).
   * Skips endpoints that already have complete data unless forced.
   */
  async enrichPlayer(
    externalId: number,
    options?: EnrichmentOptions
  ): Promise<EnrichmentResult> {
    const maxRequests = options?.maxRequests ?? 4;
    const skipIfComplete = options?.skipIfComplete ?? true;
    const year = options?.year ?? 2026;

    const beforeAudit = await this.auditPlayer(externalId, year);

    let totalRequestsUsed = 0;
    const requestsBreakdown = {
      profile: 0,
      career: 0,
      titles: 0,
      pastMatches: 0,
      total: 0,
    };
    const endpointsCalled: Array<{
      endpoint: string;
      description: string;
      requests: number;
    }> = [];

    let paginationRequired = false;

    // 1. Profile Sync
    const needsProfile =
      options?.forceProfile ||
      (beforeAudit.missingData.profile && !skipIfComplete);

    if (needsProfile) {
      if (totalRequestsUsed >= maxRequests) {
        console.warn('[PlayerEnrichment] Reached maxRequests cap before Profile sync');
      } else if (await tennisApiClient.hasBudget(1)) {
        console.log(`[PlayerEnrichment] Syncing profile for ${beforeAudit.player.name} (${externalId})...`);
        await profileSyncService.syncPlayerProfile(externalId, {
          fetchImage: false,
        });
        requestsBreakdown.profile++;
        totalRequestsUsed++;
        endpointsCalled.push({
          endpoint: `/tennis/v2/atp/player/profile/${externalId}`,
          description: 'Player profile metadata',
          requests: 1,
        });
      }
    } else {
      console.log(`[PlayerEnrichment] Profile already complete for ${beforeAudit.player.name}; skipping.`);
    }

    // 2. Career Stats Sync
    const needsCareer =
      options?.forceCareer ||
      (!beforeAudit.hasCareer && skipIfComplete) ||
      !beforeAudit.hasCareer;

    if (needsCareer) {
      if (totalRequestsUsed >= maxRequests) {
        console.warn('[PlayerEnrichment] Reached maxRequests cap before Career sync');
      } else if (await tennisApiClient.hasBudget(1)) {
        console.log(`[PlayerEnrichment] Syncing career stats for ${beforeAudit.player.name} (${externalId})...`);
        await careerSyncService.syncPlayerCareer(externalId);
        requestsBreakdown.career++;
        totalRequestsUsed++;
        endpointsCalled.push({
          endpoint: `/tennis/v2/profile/${externalId}/statistics?type=atp&includeAll=true`,
          description: 'Player career W-L, titles, finals & favourite surface',
          requests: 1,
        });
      }
    } else {
      console.log(`[PlayerEnrichment] Career stats already present for ${beforeAudit.player.name}; skipping.`);
    }

    // 3. Titles Sync
    const needsTitles =
      options?.forceTitles ||
      (beforeAudit.titlesCount === 0 && skipIfComplete) ||
      beforeAudit.titlesCount === 0;

    if (needsTitles) {
      if (totalRequestsUsed >= maxRequests) {
        console.warn('[PlayerEnrichment] Reached maxRequests cap before Titles sync');
      } else if (await tennisApiClient.hasBudget(1)) {
        console.log(`[PlayerEnrichment] Syncing titles for ${beforeAudit.player.name} (${externalId})...`);
        await titlesSyncService.syncPlayerTitles(externalId);
        requestsBreakdown.titles++;
        totalRequestsUsed++;
        endpointsCalled.push({
          endpoint: `/tennis/v2/atp/player/titles/${externalId}`,
          description: 'Player trophy cabinet categories',
          requests: 1,
        });
      }
    } else {
      console.log(`[PlayerEnrichment] Titles already present for ${beforeAudit.player.name}; skipping.`);
    }

    // 4. Past Matches 2026 Backfill
    const needsPastMatches =
      options?.forcePastMatches ||
      (beforeAudit.missingData.season2026 && skipIfComplete) ||
      beforeAudit.matches2026Count < 10;

    if (needsPastMatches) {
      if (totalRequestsUsed >= maxRequests) {
        console.warn('[PlayerEnrichment] Reached maxRequests cap before Past Matches backfill');
      } else if (await tennisApiClient.hasBudget(1)) {
        console.log(`[PlayerEnrichment] Backfilling 2026 past matches for ${beforeAudit.player.name} (${externalId})...`);
        const backfillResult = await matchSyncService.backfillPlayerSeason(
          externalId,
          year,
          { maxPages: 1 }
        );
        requestsBreakdown.pastMatches += backfillResult.requestsUsed;
        totalRequestsUsed += backfillResult.requestsUsed;
        if (backfillResult.hasNextPage) {
          paginationRequired = true;
        }
        endpointsCalled.push({
          endpoint: `/tennis/v2/atp/player/past-matches/${externalId}?filter=GameYear:${year}&include=round,tournament,tournament.court,stat`,
          description: `Full season ${year} matches and embedded stats`,
          requests: backfillResult.requestsUsed,
        });
      }
    } else {
      console.log(`[PlayerEnrichment] 2026 season matches already present for ${beforeAudit.player.name}; skipping.`);
    }

    requestsBreakdown.total = totalRequestsUsed;

    // After enrichment: audit fresh state from DB and compute aggregates
    const afterAudit = await this.auditPlayer(externalId, year);
    const seasonAggregates = await playerService.getPlayerSeasonStats(
      afterAudit.player.id,
      year
    );

    const statCoveragePct =
      afterAudit.matches2026Count > 0
        ? Math.round(
            (afterAudit.stats2026Count / afterAudit.matches2026Count) * 100
          )
        : 0;

    return {
      target: {
        rank: beforeAudit.rank,
        name: beforeAudit.player.name,
        internalId: beforeAudit.player.id,
        externalId: beforeAudit.player.externalId,
        points: beforeAudit.points,
        rankingDate: beforeAudit.rankingDate,
      },
      before: {
        hasProfile: beforeAudit.hasProfileComplete,
        hasCareer: beforeAudit.hasCareer,
        titlesCount: beforeAudit.titlesCount,
        matches2026: beforeAudit.matches2026Count,
        stats2026: beforeAudit.stats2026Count,
      },
      requestsUsed: requestsBreakdown,
      endpointsCalled,
      paginationRequired,
      after: {
        profileUpdated: afterAudit.hasProfileComplete,
        careerStats: afterAudit.careerStats,
        titlesBreakdown: afterAudit.titlesBreakdown,
        season2026Matches: afterAudit.matches2026Count,
        season2026Stats: afterAudit.stats2026Count,
        statCoveragePct,
        seasonAggregates,
      },
    };
  }
}

export const playerEnrichmentService = new PlayerEnrichmentService();
