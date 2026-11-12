import { playerRepository } from './player.repository';
import { NotFoundError } from '../../utils/apiErrors';
import { parseAge, winPercentage, firstServePct, firstServePointsWonPct, secondServePointsWonPct, breakPointsSavedPct, breakPointsConvertedPct, netPointsWonPct, normalizeSurface } from '../../utils/tennisStats';
import { PlayerProfileDto, PlayerSeasonStatsDto, PlayerComparisonDto } from './player.types';

export class PlayerService {
  async getPlayerProfile(id: number): Promise<PlayerProfileDto> {
    let player;
    try {
      player = await playerRepository.findById(id);
    } catch {
      throw new NotFoundError('Player', id);
    }
    if (!player) throw new NotFoundError('Player', id);

    let ranking = null;
    try {
      ranking = await playerRepository.getLatestRanking(id);
    } catch {
      // ranking remains null if query fails
    }

    return {
      id: player.id,
      externalId: player.externalId,
      name: player.name,
      birthday: player.birthday ? player.birthday.toISOString() : null,
      age: parseAge(player.birthday),
      countryCode: player.countryCode,
      turnedPro: player.turnedPro,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      birthplace: player.birthplace,
      residence: player.residence,
      hand: player.hand,
      backhand: player.backhand,
      coach: player.coach,
      status: player.status,
      careerHighRank: player.careerHighRank,
      careerHighDate: player.careerHighDate ? player.careerHighDate.toISOString() : null,
      imagePath: player.imagePath,
      currentRank: ranking?.rank ?? null,
      currentPoints: ranking?.points ?? null,
      careerStats: player.careerStat ? {
        careerWins: player.careerStat.careerWins,
        careerLosses: player.careerStat.careerLosses,
        careerWinPct: winPercentage(player.careerStat.careerWins, player.careerStat.careerLosses),
        favouriteSurface: player.careerStat.favouriteSurface,
        careerFinals: player.careerStat.careerFinals,
        careerTitles: player.careerStat.careerTitles,
        careerRunnerUps: player.careerStat.careerRunnerUps,
      } : null,
      titles: player.titles.map(t => ({
        tourRankId: t.tourRankId,
        tourRankName: t.tourRankName,
        titlesWon: t.titlesWon,
        finalsLost: t.finalsLost,
        isTeamCompetition: t.tourRankId === 5,
      })),
    };
  }

  async getPlayerSeasonStats(id: number, season: number): Promise<PlayerSeasonStatsDto> {
    let matches: Awaited<ReturnType<typeof playerRepository.getPlayerSeasonMatches>> = [];
    try {
      matches = await playerRepository.getPlayerSeasonMatches(id, season);
    } catch {
      matches = [];
    }

    let wins = 0;
    let losses = 0;
    const surfaceStats: Record<string, { wins: number; losses: number }> = {
      Hard: { wins: 0, losses: 0 },
      Clay: { wins: 0, losses: 0 },
      Grass: { wins: 0, losses: 0 },
    };

    let matchesWithStats = 0;
    let aces = 0;
    let doubleFaults = 0;
    let firstServe = 0;
    let firstServeOf = 0;
    let firstServePointsWon = 0;
    let firstServePointsTotal = 0;
    let secondServePointsWon = 0;
    let secondServePointsTotal = 0;
    let breakPointsSaved = 0;
    let breakPointsFaced = 0;
    let breakPointsWon = 0;
    let breakPointChances = 0;

    let winners = 0;
    let unforcedErrors = 0;
    let netApproaches = 0;
    let netApproachesTotal = 0;
    let maxFastest: number | null = null;
    let sumAvg1st = 0;
    let countAvg1st = 0;
    let sumAvg2nd = 0;
    let countAvg2nd = 0;

    for (const match of matches) {
      const isWinner = match.winnerId === id;
      if (isWinner) wins++;
      else losses++;

      const rawSurf = match.tournament?.surface;
      const tName = match.tournament?.name;
      const surface = normalizeSurface(rawSurf, tName) || 'Hard';

      if (surfaceStats[surface]) {
        if (isWinner) surfaceStats[surface].wins++;
        else surfaceStats[surface].losses++;
      } else {
        surfaceStats[surface] = { wins: isWinner ? 1 : 0, losses: isWinner ? 0 : 1 };
      }

      if (match.playerStats.length > 0) {
        const stats = match.playerStats[0];
        matchesWithStats++;
        aces += stats.aces || 0;
        doubleFaults += stats.doubleFaults || 0;
        firstServe += stats.firstServe || 0;
        firstServeOf += stats.firstServeOf || 0;
        firstServePointsWon += stats.firstServePointsWon || 0;
        firstServePointsTotal += stats.firstServePointsTotal || 0;
        secondServePointsWon += stats.secondServePointsWon || 0;
        secondServePointsTotal += stats.secondServePointsTotal || 0;
        breakPointsSaved += stats.breakPointsSaved || 0;
        breakPointsFaced += stats.breakPointsFaced || 0;
        breakPointsWon += stats.breakPointsWon || 0;
        breakPointChances += stats.breakPointChances || 0;
        winners += stats.winners || 0;
        unforcedErrors += stats.unforcedErrors || 0;
        netApproaches += stats.netApproaches || 0;
        netApproachesTotal += stats.netApproachesTotal || 0;

        if (stats.fastestServe) {
          const val = parseFloat(stats.fastestServe);
          if (!isNaN(val) && (maxFastest == null || val > maxFastest)) {
            maxFastest = val;
          }
        }
        if (stats.averageFirstServeSpeed) {
          const val = parseFloat(stats.averageFirstServeSpeed);
          if (!isNaN(val)) {
            sumAvg1st += val;
            countAvg1st++;
          }
        }
        if (stats.averageSecondServeSpeed) {
          const val = parseFloat(stats.averageSecondServeSpeed);
          if (!isNaN(val)) {
            sumAvg2nd += val;
            countAvg2nd++;
          }
        }
      }
    }

    const hasSufficientStats = matchesWithStats > 0 && !(matches.length > 5 && matchesWithStats <= 1);

    return {
      season,
      matches: matches.length,
      wins,
      losses,
      winPct: winPercentage(wins, losses),
      surfaces: Object.entries(surfaceStats).map(([surface, data]) => ({
        surface,
        wins: data.wins,
        losses: data.losses,
        winPct: winPercentage(data.wins, data.losses),
      })),
      serve: {
        aces: hasSufficientStats ? aces : null,
        doubleFaults: hasSufficientStats ? doubleFaults : null,
        firstServePct: hasSufficientStats ? firstServePct(firstServe, firstServeOf) : null,
        firstServePointsWonPct: hasSufficientStats ? firstServePointsWonPct(firstServePointsWon, firstServePointsTotal) : null,
        secondServePointsWonPct: hasSufficientStats ? secondServePointsWonPct(secondServePointsWon, secondServePointsTotal) : null,
        breakPointsSavedPct: hasSufficientStats ? breakPointsSavedPct(breakPointsSaved, breakPointsFaced) : null,
        breakPointsConvertedPct: hasSufficientStats ? breakPointsConvertedPct(breakPointsWon, breakPointChances) : null,
      },
      advanced: {
        winners: hasSufficientStats && matches.length > 0 ? winners : null,
        unforcedErrors: hasSufficientStats && matches.length > 0 ? unforcedErrors : null,
        netPointsWonPct: hasSufficientStats ? netPointsWonPct(netApproaches, netApproachesTotal) : null,
        fastestServe: hasSufficientStats && maxFastest != null ? `${maxFastest} km/h` : null,
        averageFirstServeSpeed: hasSufficientStats && countAvg1st > 0 ? `${Math.round(sumAvg1st / countAvg1st)} km/h` : null,
        averageSecondServeSpeed: hasSufficientStats && countAvg2nd > 0 ? `${Math.round(sumAvg2nd / countAvg2nd)} km/h` : null,
      },
    };
  }

  async getPlayerMatches(id: number, limit: number = 10) {
    try {
      return await playerRepository.getPlayerMatches(id, limit);
    } catch {
      return [];
    }
  }

  async comparePlayers(id1: number, id2: number): Promise<PlayerComparisonDto> {
    const player1 = await this.getPlayerProfile(id1);
    const player2 = await this.getPlayerProfile(id2);

    const currentYear = new Date().getFullYear();
    const player1SeasonStats = await this.getPlayerSeasonStats(id1, currentYear);
    const player2SeasonStats = await this.getPlayerSeasonStats(id2, currentYear);

    return {
      player1,
      player2,
      player1SeasonStats,
      player2SeasonStats,
    };
  }
}

export const playerService = new PlayerService();
