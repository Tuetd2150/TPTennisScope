import { matchSyncService } from '../modules/sync/matchSync.service';

matchSyncService.sync().then(() => {
  console.log('Match sync complete');
}).catch(console.error);
