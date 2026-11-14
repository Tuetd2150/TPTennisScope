import axios, {
  AxiosInstance,
  AxiosError,
} from 'axios';

import { env } from '../config/env';
import {
  ExternalApiError,
  QuotaExhaustedError,
} from '../utils/apiErrors';

import { syncRepository } from '../modules/sync/sync.repository';
import { getQuotaWindowKey } from '../utils/quotaWindow';

const RETRYABLE_STATUS = new Set([
  500,
  502,
  503,
  504,
]);

const MAX_RETRIES = 2;
const TIMEOUT_MS = 15000;

class TennisApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `https://${env.RAPIDAPI_HOST}`,
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Returns the canonical key for the current RapidAPI quota period.
   * Resets at RAPIDAPI_QUOTA_RESET_UTC (default 08:23 UTC / 15:23 Asia/Ho_Chi_Minh).
   */
  public getCurrentQuotaKey(): string {
    return getQuotaWindowKey();
  }

  private getTodayKey(): string {
    return this.getCurrentQuotaKey();
  }

  public async getTodayRequestCount(): Promise<number> {
    return syncRepository.getApiRequestsUsed(
      this.getCurrentQuotaKey()
    );
  }

  public async getRemainingBudget(): Promise<number> {
    const used = await this.getTodayRequestCount();

    return Math.max(
      0,
      env.DAILY_API_REQUEST_BUDGET - used
    );
  }

  public async hasBudget(
    count: number = 1
  ): Promise<boolean> {
    const remaining = await this.getRemainingBudget();
    return remaining >= count;
  }

  private isConfigured(): boolean {
    return !!env.RAPIDAPI_KEY;
  }

  private async reserveRequest(
    path: string,
    attempt: number
  ): Promise<number> {
    const remaining =
      await syncRepository.reserveApiRequest(
        this.getCurrentQuotaKey(),
        path,
        attempt,
        env.DAILY_API_REQUEST_BUDGET
      );

    if (remaining === null) {
      throw new QuotaExhaustedError();
    }

    return remaining;
  }

  private async request<T>(
    path: string,
    params?: Record<string, string | number>
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new ExternalApiError(
        'RapidAPI key not configured. Create backend/.env with RAPIDAPI_KEY=your_key'
      );
    }

    let lastError: Error | null = null;

    for (
      let attempt = 0;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        if (attempt > 0) {
          const delay =
            Math.pow(2, attempt) * 500;

          await new Promise(resolve =>
            setTimeout(resolve, delay)
          );
        }

        const remaining =
          await this.reserveRequest(
            path,
            attempt
          );

        console.log(
          `[TennisAPI] ${
            attempt > 0
              ? `Retry ${attempt} - `
              : ''
          }GET ${path} (budget: ${remaining} remaining)`
        );

        const response =
          await this.client.get<T>(path, {
            params,
            headers: {
              'x-rapidapi-key':
                env.RAPIDAPI_KEY!,
              'x-rapidapi-host':
                env.RAPIDAPI_HOST,
            },
          });

        return response.data;
      } catch (error) {
        if (error instanceof QuotaExhaustedError) {
          throw error;
        }

        // Database/programming errors must not be retried
        // as if they were HTTP failures.
        if (!axios.isAxiosError(error)) {
          throw error;
        }

        const axiosErr =
          error as AxiosError;

        const status =
          axiosErr.response?.status;

        if (
          status &&
          !RETRYABLE_STATUS.has(status)
        ) {
          throw new ExternalApiError(
            `Tennis API returned ${status} for ${path}`
          );
        }

        lastError = error as Error;

        if (attempt === MAX_RETRIES) {
          break;
        }
      }
    }

    throw new ExternalApiError(
      lastError?.message ||
        `Failed to fetch ${path}`
    );
  }

  async getRankings(
    pageNo: number = 1,
    pageSize: number = 100
  ) {
    return this.request<unknown>(
      '/tennis/v2/atp/ranking/singles',
      {
        pageNo,
        pageSize,
      }
    );
  }

  async getPlayerProfile(playerId: number) {
    return this.request<unknown>(
      `/tennis/v2/atp/player/profile/${playerId}`,
      {
        include: 'form,ranking,country',
      }
    );
  }

  async getPlayerCareerStats(playerId: number) {
    return this.request<unknown>(
      `/tennis/v2/profile/${playerId}/statistics`,
      {
        type: 'atp',
        includeAll: 'true',
      }
    );
  }

  async getPlayerTitles(playerId: number) {
    return this.request<unknown>(
      `/tennis/v2/atp/player/titles/${playerId}`
    );
  }

  async getPlayerPastMatches(
    playerId: number,
    options?: {
      year?: number;
      pageNo?: number;
      pageSize?: number;
      include?: string;
    }
  ) {
    const params: Record<string, string | number> = {
      pageNo: options?.pageNo ?? 1,
      pageSize: options?.pageSize ?? 500,
    };

    if (options?.year) {
      params.filter = `GameYear:${options.year}`;
    }

    if (options?.include) {
      params.include = options.include;
    }

    return this.request<unknown>(
      `/tennis/v2/atp/player/past-matches/${playerId}`,
      params
    );
  }

  async getResults(
    date: string,
    pageNo: number = 1,
    pageSize: number = 500
  ) {
    return this.request<unknown>(
      `/tennis/v2/atp/results/${date}`,
      {
        pageNo,
        pageSize,
        filter: 'PlayerGroup:singles',
      }
    );
  }

  async getMatchStats(
    tournamentId: number,
    player1Id: number,
    player2Id: number
  ) {
    return this.request<unknown>(
      `/tennis/v2/atp/h2h/match-stats/${tournamentId}/${player1Id}/${player2Id}`
    );
  }

  async getPlayerImage(
    imagePath: string
  ): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new ExternalApiError(
        'RapidAPI key not configured'
      );
    }

    const remaining =
      await this.reserveRequest(
        imagePath,
        0
      );

    console.log(
      `[TennisAPI] GET ${imagePath} (budget: ${remaining} remaining)`
    );

    const response =
      await this.client.get(imagePath, {
        responseType: 'arraybuffer',
        headers: {
          'x-rapidapi-key':
            env.RAPIDAPI_KEY!,
          'x-rapidapi-host':
            env.RAPIDAPI_HOST,
        },
      });

    return Buffer.from(response.data);
  }
}

export const tennisApiClient =
  new TennisApiClient();