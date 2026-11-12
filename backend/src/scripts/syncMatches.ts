import { matchSyncService } from '../modules/sync/matchSync.service';

async function main() {
  try {
    const targetDate = process.argv[2]; // optional date argument
    const result = await matchSyncService.sync(targetDate);
    console.log('[syncMatches] Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[syncMatches] Failed:', err);
    process.exit(1);
  }
}

main();
