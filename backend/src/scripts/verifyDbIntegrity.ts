import { prisma } from '../config/database';
import { parseAge } from '../utils/tennisStats';

export interface DbIntegrityReport {
  timestamp: string;
  totalPlayers: number;
  top100Count: number;
  top100WithCountry: number;
  top100WithBirthday: number;
  latestRankingDate: string | null;
  latestRankingCount: number;
  totalTournaments: number;
  totalMatches: number;
  totalMatchPlayerStats: number;
  totalCareerStats: number;
  totalTitles: number;
  totalSyncJobs: number;
  todayApiUsageRequests: number;
  pendingSyncJobs: number;
  goldenChecks: {
    zverev: {
      found: boolean;
      rank?: number;
      countryCode?: string | null;
      age?: number | null;
      has2026Matches?: boolean;
    };
    sinner: {
      found: boolean;
      rank?: number;
      countryCode?: string | null;
      hasCareer?: boolean;
      hasTitles?: boolean;
    };
    alcaraz: {
      found: boolean;
      rank?: number;
      countryCode?: string | null;
      has2026Matches?: boolean;
    };
  };
  isIntegrityPassed: boolean;
}

export async function runDbIntegrityCheck(): Promise<DbIntegrityReport> {
  console.log('=== TENNISSCOPE: DATABASE INTEGRITY AUDIT ===\n');

  // 1. Total players
  const totalPlayers = await prisma.player.count();

  // 2. Latest ranking snapshot
  const latestSnapshot = await prisma.rankingSnapshot.findFirst({
    orderBy: { rankingDate: 'desc' },
    select: { rankingDate: true },
  });

  const latestDateStr = latestSnapshot ? latestSnapshot.rankingDate.toISOString().split('T')[0] : null;

  let top100Count = 0;
  let top100WithCountry = 0;
  let top100WithBirthday = 0;
  let latestRankingCount = 0;

  if (latestSnapshot) {
    const top100 = await prisma.rankingSnapshot.findMany({
      where: {
        rankingDate: latestSnapshot.rankingDate,
        rank: { lte: 100 },
      },
      include: { player: true },
      orderBy: { rank: 'asc' },
    });

    top100Count = top100.length;
    top100WithCountry = top100.filter((s) => s.player.countryCode !== null).length;
    top100WithBirthday = top100.filter((s) => s.player.birthday !== null).length;

    latestRankingCount = await prisma.rankingSnapshot.count({
      where: { rankingDate: latestSnapshot.rankingDate },
    });
  }

  // 3. Tournaments, Matches, Stats
  const totalTournaments = await prisma.tournament.count();
  const totalMatches = await prisma.match.count();
  const totalMatchPlayerStats = await prisma.matchPlayerStat.count();
  const totalCareerStats = await prisma.playerCareerStat.count();
  const totalTitles = await prisma.playerTitle.count();
  const totalSyncJobs = await prisma.syncJob.count();

  // 4. API_USAGE today
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());

  const apiUsageResult = await prisma.syncJob.aggregate({
    where: {
      type: 'API_USAGE',
      targetKey: todayKey,
    },
    _sum: { requestsUsed: true },
  });
  const todayApiUsageRequests = apiUsageResult._sum.requestsUsed ?? 0;

  // 5. Pending jobs
  const pendingSyncJobs = await prisma.syncJob.count({
    where: { status: 'PENDING' },
  });

  // 6. Golden sanity checks
  // Alexander Zverev (externalId: 24008)
  const zverev = await prisma.player.findUnique({
    where: { externalId: 24008 },
    include: {
      rankings: latestSnapshot
        ? { where: { rankingDate: latestSnapshot.rankingDate } }
        : false,
    },
  });

  const zverevMatches = zverev
    ? await prisma.match.count({
        where: {
          matchDate: { gte: new Date('2026-01-01') },
          OR: [{ player1Id: zverev.id }, { player2Id: zverev.id }],
        },
      })
    : 0;

  // Jannik Sinner (externalId: 47275)
  const sinner = await prisma.player.findUnique({
    where: { externalId: 47275 },
    include: {
      careerStat: true,
      titles: true,
      rankings: latestSnapshot
        ? { where: { rankingDate: latestSnapshot.rankingDate } }
        : false,
    },
  });

  // Carlos Alcaraz (externalId: 68074)
  const alcaraz = await prisma.player.findUnique({
    where: { externalId: 68074 },
    include: {
      rankings: latestSnapshot
        ? { where: { rankingDate: latestSnapshot.rankingDate } }
        : false,
    },
  });

  const alcarazMatches = alcaraz
    ? await prisma.match.count({
        where: {
          matchDate: { gte: new Date('2026-01-01') },
          OR: [{ player1Id: alcaraz.id }, { player2Id: alcaraz.id }],
        },
      })
    : 0;

  const zverevRank = zverev?.rankings?.[0]?.rank;
  const sinnerRank = sinner?.rankings?.[0]?.rank;
  const alcarazRank = alcaraz?.rankings?.[0]?.rank;

  const goldenChecks = {
    zverev: {
      found: !!zverev,
      rank: zverevRank,
      countryCode: zverev?.countryCode,
      age: zverev?.birthday ? parseAge(zverev.birthday) : null,
      has2026Matches: zverevMatches > 0,
    },
    sinner: {
      found: !!sinner,
      rank: sinnerRank,
      countryCode: sinner?.countryCode,
      hasCareer: !!sinner?.careerStat,
      hasTitles: (sinner?.titles?.length ?? 0) > 0,
    },
    alcaraz: {
      found: !!alcaraz,
      rank: alcarazRank,
      countryCode: alcaraz?.countryCode,
      has2026Matches: alcarazMatches > 0,
    },
  };

  const isIntegrityPassed =
    totalPlayers >= 100 &&
    top100Count === 100 &&
    top100WithCountry === 100 &&
    goldenChecks.zverev.found &&
    goldenChecks.zverev.countryCode === 'GER' &&
    goldenChecks.sinner.found &&
    goldenChecks.alcaraz.found;

  const report: DbIntegrityReport = {
    timestamp: new Date().toISOString(),
    totalPlayers,
    top100Count,
    top100WithCountry,
    top100WithBirthday,
    latestRankingDate: latestDateStr,
    latestRankingCount,
    totalTournaments,
    totalMatches,
    totalMatchPlayerStats,
    totalCareerStats,
    totalTitles,
    totalSyncJobs,
    todayApiUsageRequests,
    pendingSyncJobs,
    goldenChecks,
    isIntegrityPassed,
  };

  console.log('--- Summary Audit Metrics ---');
  console.log(`Total Players: ${totalPlayers}`);
  console.log(`Current Top 100 Count: ${top100Count}/100`);
  console.log(`Top 100 Country Coverage: ${top100WithCountry}/100`);
  console.log(`Top 100 Birthday Coverage: ${top100WithBirthday}/100`);
  console.log(`Latest Ranking Date: ${latestDateStr} (${latestRankingCount} entries)`);
  console.log(`Tournaments: ${totalTournaments}`);
  console.log(`Matches: ${totalMatches}`);
  console.log(`MatchPlayerStats: ${totalMatchPlayerStats}`);
  console.log(`CareerStats: ${totalCareerStats}, Titles: ${totalTitles}`);
  console.log(`SyncJobs: ${totalSyncJobs} (Today API_USAGE: ${todayApiUsageRequests} reqs, Pending: ${pendingSyncJobs})`);
  console.log('\n--- Golden Sanity Checks ---');
  console.log('Zverev:', goldenChecks.zverev);
  console.log('Sinner:', goldenChecks.sinner);
  console.log('Alcaraz:', goldenChecks.alcaraz);
  console.log(`\nOverall Integrity Result: ${isIntegrityPassed ? '✅ PASS' : '❌ FAIL'}\n`);

  return report;
}

if (require.main === module) {
  runDbIntegrityCheck()
    .catch((err) => {
      console.error('Integrity check failed with error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
