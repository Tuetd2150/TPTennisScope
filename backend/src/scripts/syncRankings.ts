import { rankingSyncService } from '../modules/sync/rankingSync.service';

async function main() {
  try {
    const result = await rankingSyncService.sync();
    console.log('[syncRankings] Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[syncRankings] Failed:', err);
    process.exit(1);
  }
}

main();
