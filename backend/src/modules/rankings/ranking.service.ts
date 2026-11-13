import { rankingRepository } from './ranking.repository';
import { NotFoundError } from '../../utils/apiErrors';
import { parseAge } from '../../utils/tennisStats';

export class RankingService {
  async getRankings(limit: number = 100) {
    try {
      const rankings = await rankingRepository.getLatestRankings(limit);
      return rankings.map((item) => ({
        ...item,
        player: {
          ...item.player,
          age: parseAge(item.player.birthday),
        },
      }));
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
