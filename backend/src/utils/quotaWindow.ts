import { env } from '../config/env';

export interface QuotaResetTime {
  hour: number;
  minute: number;
}

/**
 * Parses a reset time in "HH:mm" UTC format.
 * Defaults to 08:23 if missing or invalid.
 */
export function parseQuotaResetTime(resetUtcStr?: string): QuotaResetTime {
  const raw = resetUtcStr !== undefined ? resetUtcStr : env.RAPIDAPI_QUOTA_RESET_UTC;
  const match = (raw || '08:23').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hour: 8, minute: 23 };
  }
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 8, minute: 23 };
  }
  return { hour, minute };
}

/**
 * Calculates the exact start timestamp (Date) of the RapidAPI quota window for the given moment.
 * RapidAPI's 24-hour quota resets at the configured UTC time (e.g. 08:23 UTC / 15:23 Asia/Ho_Chi_Minh).
 *
 * @param now The reference time (defaults to Date.now())
 * @param resetUtcStr Optional reset time override (format "HH:mm", defaults to env.RAPIDAPI_QUOTA_RESET_UTC)
 */
export function getQuotaWindowStart(now: Date = new Date(), resetUtcStr?: string): Date {
  const { hour, minute } = parseQuotaResetTime(resetUtcStr);

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  const candidateTodayResetMs = Date.UTC(year, month, date, hour, minute, 0, 0);

  if (now.getTime() >= candidateTodayResetMs) {
    return new Date(candidateTodayResetMs);
  } else {
    // Current time is before today's reset, so it belongs to yesterday's reset window
    const yesterdayResetMs = Date.UTC(year, month, date - 1, hour, minute, 0, 0);
    return new Date(yesterdayResetMs);
  }
}

/**
 * Calculates the exact end timestamp (Date) of the RapidAPI quota window.
 */
export function getQuotaWindowEnd(now: Date = new Date(), resetUtcStr?: string): Date {
  const start = getQuotaWindowStart(now, resetUtcStr);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Returns a deterministic, canonical string key identifying the quota window.
 * Format: "YYYY-MM-DDTHH:mm:ssZ" (e.g. "2026-11-14T08:23:00Z").
 *
 * @param now The reference time (defaults to Date.now())
 * @param resetUtcStr Optional reset time override
 */
export function getQuotaWindowKey(now: Date = new Date(), resetUtcStr?: string): string {
  const start = getQuotaWindowStart(now, resetUtcStr);
  return start.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
