import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class TournamentRepository {
  async upsertTournament(externalId: number, data: Prisma.TournamentCreateInput) {
    return prisma.tournament.upsert({
      where: { externalId },
      create: data,
      update: {
        name: data.name,
        season: data.season,
        surface: data.surface,
        courtId: data.courtId,
        countryCode: data.countryCode,
        levelName: data.levelName,
      },
    });
  }
}

export const tournamentRepository = new TournamentRepository();
