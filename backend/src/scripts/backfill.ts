import { matchSyncService } from '../modules/sync/matchSync.service';

async function main() {
  console.log('Starting backfill...');
  // A simple backfill loop over a date range.
  // Real implementation would parse --from and --to args.
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`Backfilling matches for ${date}...`);
    await matchSyncService.sync(date);
  }
  console.log('Backfill complete.');
  process.exit(0);
}

main();
