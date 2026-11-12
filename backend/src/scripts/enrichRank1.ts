import { playerEnrichmentService } from '../modules/sync/playerEnrichment.service';
import { tennisApiClient } from '../clients/tennisApi.client';
import { prisma } from '../config/database';

async function main() {
  console.log('========================================================');
  console.log('TennisScope: Controlled Live Enrichment - Current Rank #1');
  console.log('========================================================');

  // Step 1: Pre-network audit
  const usedBefore = await tennisApiClient.getTodayRequestCount();
  const budgetBefore = await tennisApiClient.getRemainingBudget();
  console.log(`[Quota Before] API_USAGE today: ${usedBefore} | Remaining local budget: ${budgetBefore}`);

  // Step 2: Audit Top 100 in DB
  console.log('\n[Top 100 Audit] Auditing Current Top 100 from latest snapshot...');
  const top100Audit = await playerEnrichmentService.auditCurrentTop100();
  console.log({
    rankingDate: top100Audit.rankingDate?.toISOString(),
    totalPlayers: top100Audit.totalPlayers,
    missingProfile: top100Audit.missingProfile,
    missingCareer: top100Audit.missingCareer,
    missingTitles: top100Audit.missingTitles,
    zeroMatches2026: top100Audit.zeroMatches2026,
    matchesUnder10: top100Audit.matchesUnder10,
    quotaEstimate: top100Audit.quotaEstimate,
  });

  // Step 3: Dynamically resolve Current Rank #1
  console.log('\n[Target Resolution] Dynamically resolving Rank #1...');
  const rank1 = await playerEnrichmentService.resolvePlayerByRank(1);
  console.log({
    rank: rank1.rank,
    name: rank1.name,
    internalId: rank1.internalId,
    externalId: rank1.externalId,
    points: rank1.points,
    rankingDate: rank1.rankingDate?.toISOString(),
  });

  // Step 4: Pre-audit for Rank #1
  const beforeTargetAudit = await playerEnrichmentService.auditPlayer(rank1.externalId, 2026);
  console.log('\n[Target Audit Before Network]');
  console.log({
    hasProfileComplete: beforeTargetAudit.hasProfileComplete,
    hasCareer: beforeTargetAudit.hasCareer,
    titlesCount: beforeTargetAudit.titlesCount,
    matches2026Count: beforeTargetAudit.matches2026Count,
    stats2026Count: beforeTargetAudit.stats2026Count,
    missingData: beforeTargetAudit.missingData,
  });

  // Step 5: Execute Controlled Live Enrichment (Hard cap <= 4 requests)
  console.log('\n[Execution] Starting controlled live enrichment (Hard cap <= 4)...');
  const enrichmentResult = await playerEnrichmentService.enrichPlayer(rank1.externalId, {
    maxRequests: 4,
    skipIfComplete: true,
    year: 2026,
  });

  // Step 6: Post-network audit
  const usedAfter = await tennisApiClient.getTodayRequestCount();
  const budgetAfter = await tennisApiClient.getRemainingBudget();
  console.log(`\n[Quota After] API_USAGE today: ${usedAfter} | Remaining local budget: ${budgetAfter}`);
  console.log(`[Delta Requests] Today usage increased by: ${usedAfter - usedBefore}`);

  // Step 7: Golden Profile & Alcaraz Safety Verification
  console.log('\n[Safety Verification] Verifying Golden Profile (Sinner) and Alcaraz (#3)...');
  const sinner = await prisma.player.findUnique({
    where: { externalId: 47275 },
    include: {
      careerStat: true,
      titles: true,
      matchesAsPlayer1: { where: { matchDate: { gte: new Date('2026-01-01') } } },
      matchesAsPlayer2: { where: { matchDate: { gte: new Date('2026-01-01') } } },
    },
  });
  const alcaraz = await prisma.player.findUnique({
    where: { externalId: 68074 },
    include: {
      careerStat: true,
      titles: true,
      matchesAsPlayer1: { where: { matchDate: { gte: new Date('2026-01-01') } } },
      matchesAsPlayer2: { where: { matchDate: { gte: new Date('2026-01-01') } } },
    },
  });

  const sinnerMatches = (sinner?.matchesAsPlayer1.length ?? 0) + (sinner?.matchesAsPlayer2.length ?? 0);
  const alcarazMatches = (alcaraz?.matchesAsPlayer1.length ?? 0) + (alcaraz?.matchesAsPlayer2.length ?? 0);

  console.log({
    sinner: {
      id: sinner?.id,
      name: sinner?.name,
      hasCareer: Boolean(sinner?.careerStat),
      titlesCount: sinner?.titles.length,
      matches2026: sinnerMatches,
      intact: Boolean(sinner?.careerStat && sinner.titles.length > 0 && sinnerMatches > 0),
    },
    alcaraz: {
      id: alcaraz?.id,
      name: alcaraz?.name,
      hasCareer: Boolean(alcaraz?.careerStat),
      titlesCount: alcaraz?.titles.length,
      matches2026: alcarazMatches,
      intact: Boolean(alcaraz?.careerStat && alcaraz.titles.length > 0 && alcarazMatches > 0),
    },
  });

  // Step 8: Check for any duplicate records
  const duplicatePlayers = await prisma.$queryRawUnsafe<Array<{ count: bigint; external_id: number }>>(`
    SELECT "externalId" as external_id, COUNT(*) as count
    FROM "Player"
    GROUP BY "externalId"
    HAVING COUNT(*) > 1
  `);
  console.log(`[Duplicate Check] Duplicate externalIds in Player table: ${duplicatePlayers.length}`);

  console.log('\n========================================================');
  console.log('SUMMARY ENRICHMENT RESULT FOR CURRENT RANK #1:');
  console.log(JSON.stringify(enrichmentResult, null, 2));
  console.log('========================================================');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[Error]', err);
  process.exit(1);
});
