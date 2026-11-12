import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class RankingRepository {
  async getLatestRankings(limit: number = 100) {
    const latestDate = await prisma.rankingSnapshot.findFirst({
      orderBy: { rankingDate: 'desc' },
      select: { rankingDate: true },
    });

    if (!latestDate) return [];

    return prisma.rankingSnapshot.findMany({
      where: { rankingDate: latestDate.rankingDate },
      include: { player: true },
      orderBy: { rank: 'asc' },
      take: limit,
    });
  }

  async getPlayerRankingHistory(playerId: number) {
    return prisma.rankingSnapshot.findMany({
      where: { playerId },
      orderBy: { rankingDate: 'asc' },
    });
  }

  async upsertRanking(data: Prisma.RankingSnapshotCreateInput) {
    return prisma.rankingSnapshot.upsert({
      where: {
        playerId_rankingDate: {
          playerId: data.player.connect!.id!,
          rankingDate: data.rankingDate,
        },
      },
      create: data,
      update: {
        rank: data.rank,
        points: data.points,
      },
    });
  }
}

export const rankingRepository = new RankingRepository();
