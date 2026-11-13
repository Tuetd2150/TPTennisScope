/**
 * Country normalization utilities for TennisScope.
 *
 * Rules:
 * - Birthplace MUST NOT be used to infer or overwrite official sporting nationality / countryCode.
 * - Country code precedence:
 *   1. Authoritative country from Ranking provider payload
 *   2. Authoritative country from Profile provider payload
 *   3. Existing trusted non-null countryCode in database
 *   4. null / unknown
 */

/**
 * Normalizes a raw country code string (trims, uppercases, validates 2-3 uppercase letters).
 * Returns null if invalid or missing.
 */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const clean = raw.trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(clean)) {
    return clean;
  }
  return null;
}
