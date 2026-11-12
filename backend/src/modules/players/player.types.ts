export interface PlayerDto {
  id: number;
  externalId: number;
  name: string;
  birthday: string | null;
  age: number | null;
  countryCode: string | null;
  turnedPro: number | null;
  heightCm: number | null;
  weightKg: number | null;
  birthplace: string | null;
  residence: string | null;
  hand: string;
  backhand: string;
  coach: string | null;
  status: string | null;
  careerHighRank: number | null;
  careerHighDate: string | null;
  imagePath: string | null;
  currentRank: number | null;
  currentPoints: number | null;
}

export interface PlayerProfileDto extends PlayerDto {
  careerStats: CareerStatsDto | null;
  titles: PlayerTitleDto[];
}

export interface CareerStatsDto {
  careerWins: number | null;
  careerLosses: number | null;
  careerWinPct: number | null;
  favouriteSurface: string | null;
  careerFinals: number | null;
  careerTitles: number | null;
  careerRunnerUps: number | null;
}

export interface PlayerTitleDto {
  tourRankId: number;
  tourRankName: string;
  titlesWon: number;
  finalsLost: number;
  isTeamCompetition: boolean;
}

export interface PlayerSeasonStatsDto {
  season: number;
  matches: number;
  wins: number;
  losses: number;
  winPct: number | null;
  surfaces: SurfaceStatsDto[];
  serve: ServeStatsDto;
  advanced: AdvancedStatsDto;
}

export interface SurfaceStatsDto {
  surface: string;
  wins: number;
  losses: number;
  winPct: number | null;
}

export interface ServeStatsDto {
  aces: number | null;
  doubleFaults: number | null;
  firstServePct: number | null;
  firstServePointsWonPct: number | null;
  secondServePointsWonPct: number | null;
  breakPointsSavedPct: number | null;
  breakPointsConvertedPct: number | null;
}

export interface AdvancedStatsDto {
  winners: number | null;
  unforcedErrors: number | null;
  netPointsWonPct: number | null;
  fastestServe: string | null;
  averageFirstServeSpeed: string | null;
  averageSecondServeSpeed: string | null;
}

export interface PlayerComparisonDto {
  player1: PlayerProfileDto;
  player2: PlayerProfileDto;
  player1SeasonStats: PlayerSeasonStatsDto | null;
  player2SeasonStats: PlayerSeasonStatsDto | null;
}
