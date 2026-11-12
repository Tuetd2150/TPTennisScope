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

  /**
   * Retrieves the latest ranking date recorded in the system.
   */
  async getLatestRankingDate(): Promise<Date | null> {
    const latest = await prisma.rankingSnapshot.findFirst({
      orderBy: { rankingDate: 'desc' },
      select: { rankingDate: true },
    });
    return latest?.rankingDate ?? null;
  }

  /**
   * Returns a dynamic Set of externalIds for the current Top 100 players from the latest RankingSnapshot.
   * Completely dynamic: derived from the latest snapshot in DB, no hardcoded names or IDs.
   */
  async getCurrentTop100ExternalIds(limit: number = 100): Promise<Set<number>> {
    const latest = await this.getLatestRankings(limit);
    return new Set(latest.map((item) => item.player.externalId));
  }

  /**
   * Retrieves rankings for a specific date (useful for historical comparisons).
   */
  async getRankingsByDate(rankingDate: Date, limit: number = 100) {
    return prisma.rankingSnapshot.findMany({
      where: { rankingDate },
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
