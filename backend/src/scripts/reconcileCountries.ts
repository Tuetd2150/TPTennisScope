import { rankingSyncService } from '../modules/sync/rankingSync.service';
import { profileSyncService } from '../modules/sync/profileSync.service';
import { tennisApiClient } from '../clients/tennisApi.client';
import { prisma } from '../config/database';

async function main() {
  console.log('=== TENNISSCOPE: COUNTRY RECONCILIATION PIPELINE ===');

  const initialUsed = await tennisApiClient.getTodayRequestCount();
  const initialBudget = await tennisApiClient.getRemainingBudget();
  console.log(`Initial status: requestsUsed=${initialUsed}, remainingBudget=${initialBudget}`);

  // 1. Audit before
  const latestSnapshotBefore = await prisma.rankingSnapshot.findFirst({
    orderBy: { rankingDate: 'desc' },
  });

  if (!latestSnapshotBefore) {
    console.error('No ranking snapshot found in database.');
    process.exit(1);
  }

  const snapshotsBefore = await prisma.rankingSnapshot.findMany({
    where: { rankingDate: latestSnapshotBefore.rankingDate },
    include: { player: true },
    orderBy: { rank: 'asc' },
  });
  const withCountryBefore = snapshotsBefore.filter(s => s.player.countryCode).length;
  const withoutCountryBefore = snapshotsBefore.filter(s => !s.player.countryCode).length;
  console.log(
    `Before: Total Top 100=${snapshotsBefore.length}, withCountry=${withCountryBefore}, withoutCountry=${withoutCountryBefore}`
  );

  // 2. Step 1: Live Ranking Sync (max 1 request)
  console.log('\n--- Step 1: Executing Live Ranking Sync ---');
  let rankingResult;
  try {
    rankingResult = await rankingSyncService.sync();
    console.log(
      `Ranking sync finished: totalSynced=${rankingResult?.totalSynced}, rankingDate=${rankingResult?.rankingDate.toISOString()}`
    );
  } catch (err) {
    console.error('Ranking sync failed:', err);
  }

  // Audit after ranking sync
  const latestSnapshotAfter = await prisma.rankingSnapshot.findFirst({
    orderBy: { rankingDate: 'desc' },
  });
  const snapshotsAfterRanking = await prisma.rankingSnapshot.findMany({
    where: { rankingDate: latestSnapshotAfter!.rankingDate },
    include: { player: true },
    orderBy: { rank: 'asc' },
  });
  const withCountryAfterRanking = snapshotsAfterRanking.filter(s => s.player.countryCode).length;
  const withoutCountryAfterRanking = snapshotsAfterRanking.filter(s => !s.player.countryCode).length;
  console.log(
    `After Ranking Sync: withCountry=${withCountryAfterRanking}, withoutCountry=${withoutCountryAfterRanking}`
  );

  const midUsed = await tennisApiClient.getTodayRequestCount();
  const midBudget = await tennisApiClient.getRemainingBudget();
  console.log(`Mid status: requestsUsed=${midUsed}, remainingBudget=${midBudget}`);

  // 3. Step 2: Profile Fallback (Strict quota-aware with safetyBuffer: 6)
  console.log('\n--- Step 2: Executing Profile Fallback for Missing Countries ---');
  const profileResult = await profileSyncService.reconcileMissingTop100Countries({
    safetyBuffer: 6,
    maxProfiles: 4,
  });
  console.log('Profile fallback result:', profileResult);

  // 4. Audit final
  const snapshotsFinal = await prisma.rankingSnapshot.findMany({
    where: { rankingDate: latestSnapshotAfter!.rankingDate },
    include: { player: true },
    orderBy: { rank: 'asc' },
  });
  const withCountryFinal = snapshotsFinal.filter(s => s.player.countryCode).length;
  const withoutCountryFinal = snapshotsFinal.filter(s => !s.player.countryCode).length;
  console.log(
    `\nFinal status: Total Top 100=${snapshotsFinal.length}, withCountry=${withCountryFinal}, withoutCountry=${withoutCountryFinal}`
  );

  const finalUsed = await tennisApiClient.getTodayRequestCount();
  const finalBudget = await tennisApiClient.getRemainingBudget();
  console.log(`Final API_USAGE: requestsUsed=${finalUsed}, remainingBudget=${finalBudget}`);
  console.log(`Total requests used in this task: ${finalUsed - initialUsed}`);
}

main()
  .catch((err) => {
    console.error('Error in reconcileCountries:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
