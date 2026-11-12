import { apiClient } from './apiClient';
import { PlayerProfileDto, PlayerSeasonStatsDto, MatchDto, PlayerTitleDto, PlayerComparisonDto } from '../types';

export async function getPlayer(id: number): Promise<PlayerProfileDto> {
  const { data } = await apiClient.get<PlayerProfileDto>(`/players/${id}`);
  return data;
}

export async function getPlayerSeasonStats(id: number, season: number = 2026): Promise<PlayerSeasonStatsDto> {
  const { data } = await apiClient.get<PlayerSeasonStatsDto>(`/players/${id}/stats`, { params: { season } });
  return data;
}

export async function getPlayerMatches(id: number, limit: number = 10): Promise<MatchDto[]> {
  const { data } = await apiClient.get<MatchDto[]>(`/players/${id}/matches`, { params: { limit } });
  return data;
}

export async function getPlayerTitles(id: number): Promise<PlayerTitleDto[]> {
  const { data } = await apiClient.get<PlayerTitleDto[]>(`/players/${id}/titles`);
  return data;
}

export async function comparePlayers(player1Id: number, player2Id: number): Promise<PlayerComparisonDto> {
  const { data } = await apiClient.get<PlayerComparisonDto>('/players/compare', {
    params: { player1: player1Id, player2: player2Id },
  });
  return data;
}
