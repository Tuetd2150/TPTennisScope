import { describe, it, expect } from 'vitest';
import { formatStat, formatWL, getCountryFlag, getSurfaceColor } from '../src/utils/format';

describe('Frontend Format Utilities', () => {
  it('formats stat correctly', () => {
    expect(formatStat(65.432, 1, '%')).toBe('65.4%');
    expect(formatStat(null)).toBe('—');
    expect(formatStat(undefined)).toBe('—');
  });

  it('formats W-L record', () => {
    expect(formatWL(20, 5)).toBe('20-5');
    expect(formatWL(null, null)).toBe('—');
  });

  it('generates country flags', () => {
    expect(getCountryFlag('ITA')).toBe('🇮🇹');
    expect(getCountryFlag('ESP')).toBe('🇪🇸');
    expect(getCountryFlag(null)).toBe('🏳️');
  });

  it('returns surface color classes', () => {
    expect(getSurfaceColor('Hard')).toContain('hard');
    expect(getSurfaceColor('Clay')).toContain('clay');
    expect(getSurfaceColor('Grass')).toContain('grass');
  });
});
