import { matchSyncService } from '../modules/sync/matchSync.service';

async function main() {
  await matchSyncService.sync();
  process.exit(0);
}

main();
