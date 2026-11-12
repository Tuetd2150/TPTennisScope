import { tennisApiClient } from '../../clients/tennisApi.client';

export class SyncService {
  protected async checkBudget(
    count: number = 1
  ): Promise<boolean> {
    const remaining =
      await tennisApiClient.getRemainingBudget();

    if (remaining < count) {
      console.warn(
        `[Sync] Daily API budget exhausted. Need ${count}, have ${remaining}`
      );

      return false;
    }

    return true;
  }
}

export const syncService = new SyncService();