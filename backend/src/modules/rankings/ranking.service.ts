import { rankingRepository } from './ranking.repository';
import { NotFoundError } from '../../utils/apiErrors';

export class RankingService {
  async getRankings(limit: number = 100) {
    try {
      return await rankingRepository.getLatestRankings(limit);
    } catch (error) {
      console.warn('[RankingService] DB query failed, returning empty rankings list:', (error as Error).message);
      return [];
    }
  }

  async getPlayerRankingHistory(playerId: number) {
    try {
      const history = await rankingRepository.getPlayerRankingHistory(playerId);
      if (!history || history.length === 0) {
        throw new NotFoundError('Ranking history for player', playerId);
      }
      return history;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new NotFoundError('Ranking history for player', playerId);
    }
  }
}

export const rankingService = new RankingService();
