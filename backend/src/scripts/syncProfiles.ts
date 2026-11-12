import { profileSyncService } from '../modules/sync/profileSync.service';

async function main() {
  await profileSyncService.processPendingProfiles();
  process.exit(0);
}

main();
