import { apiClient } from './apiClient';
import { MatchDto } from '../types';

export async function getMatch(id: number): Promise<MatchDto> {
  const { data } = await apiClient.get<MatchDto>(`/matches/${id}`);
  return data;
}
