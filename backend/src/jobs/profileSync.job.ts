import { profileSyncService } from '../modules/sync/profileSync.service';

profileSyncService.processPendingProfiles().then(() => {
  console.log('Profile sync complete');
}).catch(console.error);
