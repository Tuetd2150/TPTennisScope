import { parseHandAndBackhand, parseHeight, parseWeight } from '../../utils/tennisStats';

// Normalize player profile from API response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePlayerProfile(apiResponse: any) {
  const player = apiResponse?.player || apiResponse;
  const info = player?.information || {};

  // Prefer information-level fields if top-level is null
  const heightCm = parseHeight(player?.height) || parseHeight(info?.height);
  const weightKg = parseWeight(player?.weight) || parseWeight(info?.weight);
  const birthplace = player?.birthplace || info?.birthPlace || null;
  const residence = player?.residence || info?.residence || null;

  const { hand, backhand } = parseHandAndBackhand(player?.plays);

  return {
    externalId: player?.id,
    name: player?.name || 'Unknown',
    birthday: player?.birthday ? new Date(player.birthday) : null,
    countryCode: player?.country?.id || player?.country?.nameCode || null,
    turnedPro: player?.turnedPro ?? null,
    heightCm,
    weightKg,
    birthplace,
    residence,
    hand,
    backhand,
    coach: player?.coach || null,
    status: player?.playerStatus || null,
    careerHighRank: player?.careerHigh?.singles ?? null,
    careerHighDate: player?.careerHigh?.singlesDate ? new Date(player.careerHigh.singlesDate) : null,
    imagePath: player?.imagePath || null,
  };
}

// Normalize career statistics from API response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCareerStats(apiResponse: any) {
  const total =
    typeof apiResponse?.total === 'string'
      ? apiResponse.total.trim()
      : '';

  const match = total.match(/^(\d+)\s*-\s*(\d+)$/);

  const careerWins = match
    ? Number(match[1])
    : null;

  const careerLosses = match
    ? Number(match[2])
    : null;

  const careerHighRank =
    apiResponse?.bestRank?.position != null
      ? Number(apiResponse.bestRank.position)
      : null;

  const careerHighDate =
    apiResponse?.bestRank?.date
      ? new Date(apiResponse.bestRank.date)
      : null;

  return {
    careerWins,
    careerLosses,

    favouriteSurface:
      apiResponse?.favouriteCourt?.surface ??
      null,

    // Provider naming is misleading:
    // 31 titles + 5 runner-ups = 36 total finals
    careerFinals:
      apiResponse?.totalTitles != null
        ? Number(apiResponse.totalTitles)
        : null,

    careerTitles:
      apiResponse?.totalTitlesWon != null
        ? Number(apiResponse.totalTitlesWon)
        : null,

    careerRunnerUps:
      apiResponse?.totalFinalsWon != null
        ? Number(apiResponse.totalFinalsWon)
        : null,

    careerHighRank,
    careerHighDate,
  };
}

// Normalize match statistics from API response
// Supports both primitive property structure and object structure { successful, total }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMatchPlayerStats(stats: any, opponentStats?: any) {
  if (!stats) return null;

  const breakPointsWon =
    stats.breakPointWonGm ??
    (typeof stats.breakPoints === 'object'
      ? stats.breakPoints?.successful
      : stats.breakPointsWon ?? stats.breakPointsConverted ?? null);

  const breakPointChances =
    stats.breakPointChanceGm ??
    (typeof stats.breakPoints === 'object'
      ? stats.breakPoints?.total
      : stats.breakPointChances ?? stats.breakPointsConvertedOf ?? null);

  const oppBPOffered =
    opponentStats?.breakPointsConvertedOf ??
    (typeof opponentStats?.breakPoints === 'object'
      ? opponentStats?.breakPoints?.total
      : opponentStats?.breakPointChanceGm ?? opponentStats?.breakPointChances ?? null);

  const oppBPConverted =
    opponentStats?.breakPointsConverted ??
    (typeof opponentStats?.breakPoints === 'object'
      ? opponentStats?.breakPoints?.successful
      : opponentStats?.breakPointWonGm ?? opponentStats?.breakPointsWon ?? null);

  const breakPointsFaced =
    stats.breakPointFacedGm ??
    stats.breakPointsFaced ??
    (oppBPOffered != null ? oppBPOffered : null);

  const breakPointsSaved =
    stats.breakPointSavedGm ??
    stats.breakPointsSaved ??
    (oppBPOffered != null && oppBPConverted != null
      ? oppBPOffered - oppBPConverted
      : null);

  return {
    aces: stats.aces ?? null,
    doubleFaults: stats.doubleFaults ?? null,
    firstServe:
      typeof stats.firstServe === 'object'
        ? stats.firstServe?.successful
        : stats.firstServe ?? null,
    firstServeOf:
      typeof stats.firstServe === 'object'
        ? stats.firstServe?.total
        : stats.firstServeOf ?? null,
    firstServePointsWon:
      typeof stats.winningOnFirstServe === 'object'
        ? stats.winningOnFirstServe?.successful
        : stats.winningOnFirstServe ?? stats.firstServePointsWon ?? null,
    firstServePointsTotal:
      typeof stats.winningOnFirstServe === 'object'
        ? stats.winningOnFirstServe?.total
        : stats.winningOnFirstServeOf ?? stats.firstServePointsTotal ?? null,
    secondServePointsWon:
      typeof stats.winningOnSecondServe === 'object'
        ? stats.winningOnSecondServe?.successful
        : stats.winningOnSecondServe ?? stats.secondServePointsWon ?? null,
    secondServePointsTotal:
      typeof stats.winningOnSecondServe === 'object'
        ? stats.winningOnSecondServe?.total
        : stats.winningOnSecondServeOf ?? stats.secondServePointsTotal ?? null,
    breakPointsFaced,
    breakPointsSaved,
    breakPointChances,
    breakPointsWon,
    winners: stats.winners ?? null,
    unforcedErrors: stats.unforcedErrors ?? null,
    netApproaches:
      stats.netApproaches ??
      (typeof stats.netPoints === 'object'
        ? stats.netPoints?.successful
        : null),
    netApproachesTotal:
      stats.netApproachesOf ??
      (typeof stats.netPoints === 'object'
        ? stats.netPoints?.total
        : stats.netApproachesTotal ?? null),
    totalPointsWon:
      typeof stats.totalPoints === 'object'
        ? stats.totalPoints?.successful
        : stats.totalPointsWon ?? null,
    fastestServe:
      stats.fastestServe != null ? String(stats.fastestServe) : null,
    averageFirstServeSpeed:
      stats.averageFirstServeSpeed != null
        ? String(stats.averageFirstServeSpeed)
        : null,
    averageSecondServeSpeed:
      stats.averageSecondServeSpeed != null
        ? String(stats.averageSecondServeSpeed)
        : null,
  };
}

// Normalize player titles from API response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePlayerTitles(apiResponse: any) {
  const titles = Array.isArray(apiResponse?.data)
    ? apiResponse.data
    : Array.isArray(apiResponse?.titles)
      ? apiResponse.titles
      : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return titles.map((t: any) => ({
    tourRankId: Number(t.tourRankId),

    tourRankName:
      t.tourRank ||
      getTourRankName(Number(t.tourRankId)),

    titlesWon:
      t.titlesWon != null
        ? Number(t.titlesWon)
        : 0,

    finalsLost:
      t.titlesLost != null
        ? Number(t.titlesLost)
        : 0,
  }));
}

function getTourRankName(id: number): string {
  const names: Record<number, string> = {
    0: 'Futures/Satellites/ITF $10K',
    1: 'Challengers/ITF > $10K',
    2: 'Main tour',
    3: 'Masters series',
    4: 'Grand Slam',
    5: 'Davis/Fed Cup',
    7: 'Tour finals',
  };
  return names[id] || `Level ${id}`;
}

// Normalize player from results/ranking API (minimal data)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePlayerMinimal(apiPlayer: any) {
  return {
    externalId: apiPlayer.id,
    name: apiPlayer.name,
    countryCode: apiPlayer.country?.id || apiPlayer.country?.nameCode || null,
  };
}

export const normalizePlayer = normalizePlayerMinimal;
