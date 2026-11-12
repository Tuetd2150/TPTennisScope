import { apiClient } from './apiClient';
import { RankingEntryDto, RankingHistoryDto } from '../types';

export async function getRankings(): Promise<RankingEntryDto[]> {
  const { data } = await apiClient.get<RankingEntryDto[]>('/rankings');
  return data;
}

export async function getRankingHistory(playerId: number): Promise<RankingHistoryDto[]> {
  const { data } = await apiClient.get<RankingHistoryDto[]>(`/rankings/history/${playerId}`);
  return data;
}
