import { describe, it, expect, vi, afterEach } from 'vitest';
import { playerEnrichmentService } from '../src/modules/sync/playerEnrichment.service';
import { tennisApiClient } from '../src/clients/tennisApi.client';
import { careerSyncService } from '../src/modules/sync/careerSync.service';
import { titlesSyncService } from '../src/modules/sync/titlesSync.service';
import { matchSyncService } from '../src/modules/sync/matchSync.service';
import { profileSyncService } from '../src/modules/sync/profileSync.service';

describe('Player Enrichment & 2026 Season Backfill Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auditCurrentTop100', () => {
    it('should audit the current Top 100 and produce valid counts and quota estimate', async () => {
      const audit = await playerEnrichmentService.auditCurrentTop100();

      expect(audit.totalPlayers).toBe(100);
      expect(audit.rankingDate).toBeInstanceOf(Date);
      expect(audit.missingProfile).toBeGreaterThanOrEqual(0);
      expect(audit.missingCareer).toBeGreaterThanOrEqual(0);
      expect(audit.missingTitles).toBeGreaterThanOrEqual(0);
      expect(audit.quotaEstimate.totalConservativeRequests).toBe(
        audit.missingProfile +
          audit.missingCareer +
          audit.missingTitles +
          audit.totalPlayers
      );
    });
  });

  describe('resolvePlayerByRank', () => {
    it('should dynamically resolve Rank #1 from latest snapshot in DB', async () => {
      const player1 = await playerEnrichmentService.resolvePlayerByRank(1);

      expect(player1.rank).toBe(1);
      expect(player1.name).toBeTruthy();
      expect(player1.internalId).toBeGreaterThan(0);
      expect(player1.externalId).toBeGreaterThan(0);
      expect(player1.points).toBeGreaterThan(0);
      expect(player1.rankingDate).toBeInstanceOf(Date);
    });

    it('should dynamically resolve Rank #2 and Rank #3 from latest snapshot in DB', async () => {
      const player2 = await playerEnrichmentService.resolvePlayerByRank(2);
      const player3 = await playerEnrichmentService.resolvePlayerByRank(3);

      expect(player2.rank).toBe(2);
      expect(player3.rank).toBe(3);
      expect(player2.externalId).not.toBe(player3.externalId);
    });
  });

  describe('Quota Guards & Skipping Logic in enrichPlayer', () => {
    it('should skip Profile sync when profile is already complete and skipIfComplete is true', async () => {
      // Mock player state where Profile is complete, but Career, Titles, and Season are missing
      vi.spyOn(playerEnrichmentService, 'auditPlayer').mockResolvedValue({
        player: {
          id: 999,
          externalId: 99999,
          name: 'Mock Player',
          birthday: new Date('1995-01-01'),
          countryCode: 'GER',
          turnedPro: 2012,
          heightCm: 190,
          weightKg: 85,
          coach: 'Coach Name',
          hand: 'RIGHT',
          backhand: 'TWO_HANDED',
        },
        rank: 1,
        points: 9000,
        rankingDate: new Date(),
        hasProfileComplete: true,
        hasCareer: false,
        careerStats: null,
        titlesCount: 0,
        titlesBreakdown: [],
        matches2026Count: 2,
        stats2026Count: 2,
        missingData: {
          profile: false,
          career: true,
          titles: true,
          season2026: true,
        },
      });

      const profileSpy = vi
        .spyOn(profileSyncService, 'syncPlayerProfile')
        .mockResolvedValue({} as never);

      const careerSpy = vi
        .spyOn(careerSyncService, 'syncPlayerCareer')
        .mockResolvedValue({
          careerWins: 500,
          careerLosses: 200,
          favouriteSurface: 'Hard',
          careerFinals: 30,
          careerTitles: 20,
          careerRunnerUps: 10,
          careerHighRank: 1,
          careerHighDate: new Date(),
        });

      const titlesSpy = vi
        .spyOn(titlesSyncService, 'syncPlayerTitles')
        .mockResolvedValue([
          {
            tourRankId: 4,
            tourRankName: 'Grand Slam',
            titlesWon: 2,
            finalsLost: 1,
          },
        ]);

      const backfillSpy = vi
        .spyOn(matchSyncService, 'backfillPlayerSeason')
        .mockResolvedValue({
          totalMatches: 45,
          newMatches: 40,
          requestsUsed: 1,
          hasNextPage: false,
        });

      vi.spyOn(tennisApiClient, 'hasBudget').mockResolvedValue(true);

      const result = await playerEnrichmentService.enrichPlayer(99999, {
        maxRequests: 4,
        skipIfComplete: true,
      });

      // Profile request should be 0 because it was skipped
      expect(result.requestsUsed.profile).toBe(0);
      expect(profileSpy).not.toHaveBeenCalled();
      expect(careerSpy).toHaveBeenCalledTimes(1);
      expect(titlesSpy).toHaveBeenCalledTimes(1);
      expect(backfillSpy).toHaveBeenCalledTimes(1);
      expect(result.requestsUsed.total).toBe(3);
    });

    it('should enforce hard request cap and stop when maxRequests is reached', async () => {
      vi.spyOn(playerEnrichmentService, 'auditPlayer').mockResolvedValue({
        player: {
          id: 999,
          externalId: 99999,
          name: 'Mock Player',
          birthday: new Date('1995-01-01'),
          countryCode: 'GER',
          turnedPro: 2012,
          heightCm: 190,
          weightKg: 85,
          coach: 'Coach Name',
          hand: 'RIGHT',
          backhand: 'TWO_HANDED',
        },
        rank: 1,
        points: 9000,
        rankingDate: new Date(),
        hasProfileComplete: true,
        hasCareer: false,
        careerStats: null,
        titlesCount: 0,
        titlesBreakdown: [],
        matches2026Count: 2,
        stats2026Count: 2,
        missingData: {
          profile: false,
          career: true,
          titles: true,
          season2026: true,
        },
      });

      const careerSpy = vi
        .spyOn(careerSyncService, 'syncPlayerCareer')
        .mockResolvedValue({
          careerWins: 100,
          careerLosses: 50,
          favouriteSurface: 'Clay',
          careerFinals: 5,
          careerTitles: 3,
          careerRunnerUps: 2,
          careerHighRank: 5,
          careerHighDate: null,
        });

      const titlesSpy = vi
        .spyOn(titlesSyncService, 'syncPlayerTitles')
        .mockResolvedValue([]);

      const backfillSpy = vi
        .spyOn(matchSyncService, 'backfillPlayerSeason')
        .mockResolvedValue({
          totalMatches: 10,
          newMatches: 10,
          requestsUsed: 1,
          hasNextPage: false,
        });

      vi.spyOn(tennisApiClient, 'hasBudget').mockResolvedValue(true);

      // Set maxRequests = 1 so only Career can run, Titles and PastMatches must be capped
      const result = await playerEnrichmentService.enrichPlayer(99999, {
        maxRequests: 1,
        skipIfComplete: true,
      });

      expect(result.requestsUsed.total).toBe(1);
      expect(careerSpy).toHaveBeenCalledTimes(1);
      expect(titlesSpy).not.toHaveBeenCalled();
      expect(backfillSpy).not.toHaveBeenCalled();
    });

    it('should respect maxPages limit and not fetch subsequent pages when pagination is present', async () => {
      vi.spyOn(playerEnrichmentService, 'auditPlayer').mockResolvedValue({
        player: {
          id: 999,
          externalId: 99999,
          name: 'Mock Player',
          birthday: new Date('1995-01-01'),
          countryCode: 'GER',
          turnedPro: 2012,
          heightCm: 190,
          weightKg: 85,
          coach: 'Coach Name',
          hand: 'RIGHT',
          backhand: 'TWO_HANDED',
        },
        rank: 1,
        points: 9000,
        rankingDate: new Date(),
        hasProfileComplete: true,
        hasCareer: true,
        careerStats: {
          careerWins: 100,
          careerLosses: 50,
          careerTitles: 2,
          careerFinals: 3,
          favouriteSurface: 'Hard',
        },
        titlesCount: 2,
        titlesBreakdown: [],
        matches2026Count: 2,
        stats2026Count: 2,
        missingData: {
          profile: false,
          career: false,
          titles: false,
          season2026: true,
        },
      });

      vi.spyOn(matchSyncService, 'backfillPlayerSeason').mockResolvedValue({
        totalMatches: 50,
        newMatches: 50,
        requestsUsed: 1,
        hasNextPage: true, // indicates more pages were available
      });

      vi.spyOn(tennisApiClient, 'hasBudget').mockResolvedValue(true);

      const result = await playerEnrichmentService.enrichPlayer(99999, {
        maxRequests: 4,
        skipIfComplete: true,
      });

      expect(result.paginationRequired).toBe(true);
      expect(result.requestsUsed.pastMatches).toBe(1);
      // Strictly 1 request used for past matches
    });
  });
});
