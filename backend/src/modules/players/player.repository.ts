import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class PlayerRepository {
  async findById(id: number) {
    return prisma.player.findUnique({
      where: { id },
      include: {
        careerStat: true,
        titles: true,
      },
    });
  }

  async findByExternalId(externalId: number) {
    return prisma.player.findUnique({
      where: { externalId },
      include: {
        careerStat: true,
        titles: true,
      },
    });
  }

  /**
   * Precedence #1: Upsert player identity from authoritative Ranking provider payload.
   * Ranking country takes precedence over unverified data, but preserves existing
   * non-null countryCode if ranking payload does not supply one.
   */
  async upsertFromRanking(
    externalId: number,
    data: { name: string; countryCode?: string | null }
  ) {
    const existing = await prisma.player.findUnique({
      where: { externalId },
      select: { id: true, countryCode: true },
    });

    const finalCountry = data.countryCode || existing?.countryCode || null;

    if (!existing) {
      return prisma.player.create({
        data: {
          externalId,
          name: data.name,
          countryCode: finalCountry,
        },
      });
    }

    return prisma.player.update({
      where: { externalId },
      data: {
        name: data.name,
        ...(finalCountry ? { countryCode: finalCountry } : {}),
      },
    });
  }

  /**
   * Precedence #4 / Minimal Opponents:
   * Minimal Match/Results data MUST NOT overwrite an existing trusted non-null countryCode.
   * Only assigns countryCode if the player record currently has NO countryCode (null).
   */
  async upsertFromExternal(externalId: number, data: Prisma.PlayerCreateInput) {
    const existing = await prisma.player.findUnique({
      where: { externalId },
      select: { id: true, countryCode: true },
    });

    if (!existing) {
      return prisma.player.create({
        data,
      });
    }

    // Never overwrite an existing trusted countryCode with minimal match data
    const shouldUpdateCountry = !existing.countryCode && Boolean(data.countryCode);

    return prisma.player.update({
      where: { externalId },
      data: {
        name: data.name,
        ...(shouldUpdateCountry ? { countryCode: data.countryCode } : {}),
        // Don't overwrite detailed profile fields with minimal data
      },
    });
  }

  /**
   * Precedence #2: Upsert detailed Profile from Profile provider payload.
   * Uses authoritative profile country if present; otherwise preserves existing trusted countryCode.
   */
  async upsertFullProfile(externalId: number, data: Prisma.PlayerCreateInput) {
    const existing = await prisma.player.findUnique({
      where: { externalId },
      select: { id: true, countryCode: true },
    });

    const finalCountry = data.countryCode || existing?.countryCode || null;

    return prisma.player.upsert({
      where: { externalId },
      create: {
        ...data,
        countryCode: finalCountry,
      },
      update: {
        name: data.name,
        birthday: data.birthday,
        countryCode: finalCountry,
        turnedPro: data.turnedPro,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        birthplace: data.birthplace,
        residence: data.residence,
        hand: data.hand,
        backhand: data.backhand,
        coach: data.coach,
        status: data.status,
        careerHighRank: data.careerHighRank,
        careerHighDate: data.careerHighDate,
        imagePath: data.imagePath,
      },
    });
  }

  async getLatestRanking(playerId: number) {
    return prisma.rankingSnapshot.findFirst({
      where: { playerId },
      orderBy: { rankingDate: 'desc' },
    });
  }

  async getPlayerMatches(playerId: number, limit: number = 10) {
    return prisma.match.findMany({
      where: {
        OR: [
          { player1Id: playerId },
          { player2Id: playerId },
        ],
      },
      include: {
        player1: true,
        player2: true,
        winner: true,
        tournament: true,
        playerStats: true,
      },
      orderBy: { matchDate: 'desc' },
      take: limit,
    });
  }

  async getPlayerSeasonMatches(playerId: number, season: number) {
    const startDate = new Date(`${season}-01-01`);
    const endDate = new Date(`${season + 1}-01-01`);
    return prisma.match.findMany({
      where: {
        AND: [
          {
            OR: [
              { player1Id: playerId },
              { player2Id: playerId },
            ],
          },
          { matchDate: { gte: startDate, lt: endDate } },
        ],
      },
      include: {
        tournament: true,
        playerStats: {
          where: { playerId },
        },
      },
    });
  }

  async updateCareerHigh(
  externalId: number,
  careerHighRank: number | null,
  careerHighDate: Date | null
  ) {
    return prisma.player.update({
      where: { externalId },
      data: {
        careerHighRank,
        careerHighDate,
      },
    });
  }

  async upsertCareerStat(playerId: number, data: {
    careerWins?: number | null;
    careerLosses?: number | null;
    favouriteSurface?: string | null;
    careerFinals?: number | null;
    careerTitles?: number | null;
    careerRunnerUps?: number | null;
  }) {
    return prisma.playerCareerStat.upsert({
      where: { playerId },
      create: { playerId, ...data },
      update: data,
    });
  }

  async upsertTitle(playerId: number, tourRankId: number, data: {
    tourRankName: string;
    titlesWon: number;
    finalsLost: number;
  }) {
    return prisma.playerTitle.upsert({
      where: {
        playerId_tourRankId: { playerId, tourRankId },
      },
      create: { playerId, tourRankId, ...data },
      update: data,
    });
  }
}

export const playerRepository = new PlayerRepository();
