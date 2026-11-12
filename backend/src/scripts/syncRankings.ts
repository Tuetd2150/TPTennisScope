import { rankingSyncService } from '../modules/sync/rankingSync.service';

async function main() {
  await rankingSyncService.sync();
  process.exit(0);
}

main();
