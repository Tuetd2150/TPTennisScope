import { describe, it, expect, afterEach, afterAll } from 'vitest';
import {
  computeTop100MembershipChanges,
} from '../src/modules/sync/rankingSync.service';
import {
  shouldTrackSinglesMatch,
  matchSyncService,
} from '../src/modules/sync/matchSync.service';
import { rankingRepository } from '../src/modules/rankings/ranking.repository';
import { prisma } from '../src/config/database';
import {
  initScheduler,
  stopScheduler,
  getSchedulerState,
  SCHEDULER_CRON_EXPRESSIONS,
} from '../src/jobs/scheduler';
import { env } from '../src/config/env';

describe('Dynamic ATP Top 100 & Membership Diff (ENTER / STAY / LEAVE)', () => {
  it('should correctly detect all STAYED when Top 100 players do not change', () => {
    const previous = Array.from({ length: 100 }, (_, i) => i + 1);
    const next = [...previous];

    const diff = computeTop100MembershipChanges(previous, next);

    expect(diff.stayed.length).toBe(100);
    expect(diff.entered.length).toBe(0);
    expect(diff.left.length).toBe(0);
    expect(new Set(diff.stayed)).toEqual(new Set(previous));
  });

  it('should detect 1 ENTER and 1 LEAVE when a new player replaces an existing one', () => {
    const previous = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    // Player 100 leaves, player 999 enters at rank 95
    const next = previous.filter((id) => id !== 100).concat(999);

    const diff = computeTop100MembershipChanges(previous, next);

    expect(diff.stayed.length).toBe(99);
    expect(diff.entered).toEqual([999]);
    expect(diff.left).toEqual([100]);
  });

  it('should detect multiple ENTERS and LEAVES correctly', () => {
    const previous = [10, 20, 30, 40, 50];
    const next = [20, 30, 50, 60, 70]; // 10, 40 left; 60, 70 entered

    const diff = computeTop100MembershipChanges(previous, next);

    expect(diff.stayed).toEqual([20, 30, 50]);
    expect(diff.entered).toEqual([60, 70]);
    expect(diff.left).toEqual([10, 40]);
  });

  it('should mark all as ENTERED when previous set was empty (initial snapshot)', () => {
    const previous: number[] = [];
    const next = Array.from({ length: 100 }, (_, i) => i + 1000);

    const diff = computeTop100MembershipChanges(previous, next);

    expect(diff.entered.length).toBe(100);
    expect(diff.stayed.length).toBe(0);
    expect(diff.left.length).toBe(0);
  });
});

describe('Match Tracking OR Rule (shouldTrackSinglesMatch)', () => {
  const currentTop100 = new Set<number>([101, 102, 103, 104, 105]);

  it('should track match when both players are in Current Top 100 (Top100 vs Top100)', () => {
    expect(shouldTrackSinglesMatch(101, 102, currentTop100)).toBe(true);
  });

  it('should track match when player 1 is in Top 100 and player 2 is outside (#1 vs #150)', () => {
    expect(shouldTrackSinglesMatch(101, 999, currentTop100)).toBe(true);
  });

  it('should track match when player 1 is outside and player 2 is in Top 100 (#150 vs #50)', () => {
    expect(shouldTrackSinglesMatch(999, 103, currentTop100)).toBe(true);
  });

  it('should IGNORE match when neither player is in Current Top 100 (#110 vs #180)', () => {
    expect(shouldTrackSinglesMatch(901, 902, currentTop100)).toBe(false);
  });
});

describe('Scheduler Specifications & Anti-Overlap Protection', () => {
  afterEach(() => {
    stopScheduler();
  });

  it('should define correct cron schedule for ranking sync (daily at 03:00)', () => {
    expect(SCHEDULER_CRON_EXPRESSIONS.RANKING_SYNC).toBe('0 3 * * *');
  });

  it('should define correct cron schedule for match sync (every 6 hours: 0, 6, 12, 18)', () => {
    expect(SCHEDULER_CRON_EXPRESSIONS.MATCH_SYNC).toBe('0 0,6,12,18 * * *');
  });

  it('should use configured project timezone (Asia/Ho_Chi_Minh)', () => {
    expect(env.SYNC_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
  });

  it('should initialize and stop tasks cleanly without duplicate registrations', () => {
    const first = initScheduler();
    expect(first.matchTask).toBeDefined();
    expect(first.rankingTask).toBeDefined();
    expect(first.profileTask).toBeDefined();

    const state1 = getSchedulerState();
    expect(state1.isInitialized).toBe(true);
    expect(state1.timezone).toBe('Asia/Ho_Chi_Minh');

    // Calling initScheduler again stops previous tasks first
    const second = initScheduler();
    expect(second.matchTask).toBeDefined();

    stopScheduler();
    const state2 = getSchedulerState();
    expect(state2.isInitialized).toBe(false);
  });
});

describe('Database Dynamic Top 100 derivation', () => {
  it('should load current Top 100 external IDs dynamically from PostgreSQL', async () => {
    const top100ExternalIds = await rankingRepository.getCurrentTop100ExternalIds();

    expect(top100ExternalIds).toBeInstanceOf(Set);
    expect(top100ExternalIds.size).toBe(100);

    // Verify dynamic resolution from DB: Jannik Sinner (externalId 47275) is rank 1 in DB
    expect(top100ExternalIds.has(47275)).toBe(true);

    // Arbitrary unknown externalId should not be in the Top 100
    expect(top100ExternalIds.has(99999999)).toBe(false);
  });

  it('should retrieve latest ranking date from DB', async () => {
    const latestDate = await rankingRepository.getLatestRankingDate();
    expect(latestDate).toBeInstanceOf(Date);
    expect(latestDate!.getFullYear()).toBe(2026);
  });
});

describe('Incremental Match Sync with Mock/Fixture (OR Rule & Idempotency)', () => {
  const TEST_MATCH_ID = 999991;
  const TEST_TOURNAMENT_ID = 99991;
  const TEST_OPPONENT_ID = 888891;

  afterAll(async () => {
    // Clean up any test records created during testing
    await prisma.match.deleteMany({ where: { externalMatchId: TEST_MATCH_ID } });
    await prisma.syncJob.deleteMany({ where: { targetKey: '2026-09-30' } });
    await prisma.syncJob.deleteMany({ where: { targetKey: `${TEST_MATCH_ID}` } });
    await prisma.tournament.deleteMany({ where: { externalId: TEST_TOURNAMENT_ID } });
    await prisma.player.deleteMany({ where: { externalId: TEST_OPPONENT_ID } });
  });

  it('should filter matches based on Current Top 100 and ignore outside-vs-outside matches', async () => {
    const top100ExternalIds = await rankingRepository.getCurrentTop100ExternalIds();
    const trackedId = Array.from(top100ExternalIds)[0];
    const existingPlayer = await prisma.player.findUnique({ where: { externalId: trackedId } });
    const trackedName = existingPlayer?.name || 'Tracked Player';

    const mockResults = [
      {
        matchId: TEST_MATCH_ID,
        date: '2026-09-30T00:00:00',
        player1: { id: trackedId, name: trackedName, country: { id: 'ITA' } },
        player2: { id: TEST_OPPONENT_ID, name: 'Outside Qualifier', country: { id: 'FRA' } },
        match_winner: trackedId,
        result: '6-4, 6-4',
        result_type: 'COMPLETED',
        tournament: { id: TEST_TOURNAMENT_ID, name: 'Test Fixture Open', courtId: 1, surface: 'Hard' },
      },
      {
        matchId: 999992,
        date: '2026-09-30T00:00:00',
        player1: { id: 888892, name: 'Outside Challenger A', country: { id: 'ESP' } },
        player2: { id: 888893, name: 'Outside Challenger B', country: { id: 'GER' } },
        match_winner: 888892,
        result: '7-6, 6-3',
        result_type: 'COMPLETED',
        tournament: { id: TEST_TOURNAMENT_ID, name: 'Test Fixture Open', courtId: 1, surface: 'Hard' },
      },
    ];

    // First run: should insert the tracked match (trackedId vs TEST_OPPONENT_ID) and ignore outside vs outside
    const result1 = await matchSyncService.sync('2026-09-30', mockResults);

    expect(result1).toBeDefined();
    expect(result1?.processed).toBe(2);
    expect(result1?.inserted).toBe(1);
    expect(result1?.ignoredOutsideTop100).toBe(1);
    expect(result1?.requestsUsed).toBe(0); // ZERO provider requests used!

    // Second run with the same data: should be completely idempotent
    const result2 = await matchSyncService.sync('2026-09-30', mockResults);

    expect(result2).toBeDefined();
    expect(result2?.processed).toBe(2);
    expect(result2?.inserted).toBe(1); // upserted cleanly
    expect(result2?.ignoredOutsideTop100).toBe(1);
    expect(result2?.requestsUsed).toBe(0);
  });
});
