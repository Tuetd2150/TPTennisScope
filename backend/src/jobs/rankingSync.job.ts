import { rankingSyncService } from '../modules/sync/rankingSync.service';

rankingSyncService.sync().then(() => {
  console.log('Ranking sync complete');
}).catch(console.error);
