import { profileSyncService } from '../modules/sync/profileSync.service';
import { tennisApiClient } from '../clients/tennisApi.client';
import { prisma } from '../config/database';
import { parseAge } from '../utils/tennisStats';

async function main() {
  console.log('=== TENNISSCOPE: TOP 100 BIRTHDAY / AGE RECONCILIATION ===');

  const initialUsed = await tennisApiClient.getTodayRequestCount();
  const initialBudget = await tennisApiClient.getRemainingBudget();
  console.log(`Initial status: requestsUsed=${initialUsed}, remainingBudget=${initialBudget}`);

  // 1. Audit before
  const latestDate = await prisma.rankingSnapshot.findFirst({
    orderBy: { rankingDate: 'desc' },
    select: { rankingDate: true },
  });

  if (!latestDate) {
    console.error('No ranking snapshot found in database.');
    process.exit(1);
  }

  const snapshotsBefore = await prisma.rankingSnapshot.findMany({
    where: { rankingDate: latestDate.rankingDate },
    include: { player: true },
    orderBy: { rank: 'asc' },
  });

  const withBirthdayBefore = snapshotsBefore.filter(s => s.player.birthday).length;
  const withoutBirthdayBefore = snapshotsBefore.filter(s => !s.player.birthday).length;
  console.log(
    `Before: Total Top 100=${snapshotsBefore.length}, withBirthday=${withBirthdayBefore}, withoutBirthday=${withoutBirthdayBefore}`
  );

  // 2. Reconcile with safety buffer 6
  console.log('\n--- Executing Quota-Aware Profile Reconcile for Birthdays ---');
  const result = await profileSyncService.reconcileMissingTop100Birthdays({
    safetyBuffer: 6,
    maxProfiles: 38, // Up to 38 requests today to strictly respect safety buffer 6
  });

  console.log('\nReconciliation result:', result);

  // 3. Audit after
  const snapshotsAfter = await prisma.rankingSnapshot.findMany({
    where: { rankingDate: latestDate.rankingDate },
    include: { player: true },
    orderBy: { rank: 'asc' },
  });

  const withBirthdayAfter = snapshotsAfter.filter(s => s.player.birthday).length;
  const withoutBirthdayAfter = snapshotsAfter.filter(s => !s.player.birthday).length;
  console.log(
    `\nAfter: Total Top 100=${snapshotsAfter.length}, withBirthday=${withBirthdayAfter}, withoutBirthday=${withoutBirthdayAfter}`
  );

  // Show sample of newly updated players with age
  const sampleWithAge = snapshotsAfter
    .filter(s => s.player.birthday)
    .slice(0, 10)
    .map(s => ({
      rank: s.rank,
      name: s.player.name,
      birthday: s.player.birthday?.toISOString().split('T')[0],
      age: parseAge(s.player.birthday),
    }));
  console.log('Sample Top 10 players with Age:', sampleWithAge);

  const finalUsed = await tennisApiClient.getTodayRequestCount();
  const finalBudget = await tennisApiClient.getRemainingBudget();
  console.log(`\nFinal API_USAGE: requestsUsed=${finalUsed}, remainingBudget=${finalBudget}`);
  console.log(`Total requests used in this run: ${finalUsed - initialUsed}`);
}

main()
  .catch((err) => {
    console.error('Error in syncTop100Profiles:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
