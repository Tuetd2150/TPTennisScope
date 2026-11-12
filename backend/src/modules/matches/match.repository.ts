import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class MatchRepository {
  async findById(id: number) {
    return prisma.match.findUnique({
      where: { id },
      include: {
        tournament: true,
        player1: true,
        player2: true,
        winner: true,
        loser: true,
        playerStats: true,
      },
    });
  }

  async findByExternalId(externalMatchId: number) {
    return prisma.match.findUnique({
      where: { externalMatchId },
    });
  }

  async createMatch(data: Prisma.MatchCreateInput) {
    return prisma.match.create({ data });
  }

  async upsertMatch(externalMatchId: number, data: Prisma.MatchCreateInput) {
    return prisma.match.upsert({
      where: { externalMatchId },
      create: data,
      update: data, // update all fields if match changes
    });
  }

  async upsertMatchPlayerStat(matchId: number, playerId: number, data: Omit<Prisma.MatchPlayerStatCreateInput, 'match' | 'player'>) {
    return prisma.matchPlayerStat.upsert({
      where: {
        matchId_playerId: { matchId, playerId },
      },
      create: {
        match: { connect: { id: matchId } },
        player: { connect: { id: playerId } },
        ...data,
      },
      update: data,
    });
  }
}

export const matchRepository = new MatchRepository();
