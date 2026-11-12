import { matchRepository } from './match.repository';
import { NotFoundError } from '../../utils/apiErrors';

export class MatchService {
  async getMatchDetails(id: number) {
    const match = await matchRepository.findById(id);
    if (!match) throw new NotFoundError('Match', id);
    return match;
  }
}

export const matchService = new MatchService();
