import { describe, it, expect } from 'vitest';
import { normalizePlayer, normalizeMatchPlayerStats } from '../src/modules/sync/normalizers';

describe('Normalizers', () => {
  it('normalizePlayer', () => {
    const input = { id: 123, name: 'Roger', country: { nameCode: 'SUI' } };
    expect(normalizePlayer(input)).toEqual({
      externalId: 123,
      name: 'Roger',
      countryCode: 'SUI'
    });
  });

  it('normalizeMatchPlayerStats', () => {
    const input = {
      aces: 10,
      doubleFaults: 2,
      firstServe: { successful: 40, total: 60 }
    };
    const result = normalizeMatchPlayerStats(input);
    expect(result?.aces).toBe(10);
    expect(result?.firstServe).toBe(40);
    expect(result?.firstServeOf).toBe(60);
  });

  it('normalizeMatchPlayerStats with opponentStats derives break points faced and saved', () => {
    const myStats = {
      breakPointsConverted: 2,
      breakPointsConvertedOf: 5,
    };
    const opponentStats = {
      breakPointsConverted: 1,
      breakPointsConvertedOf: 4,
    };
    const result = normalizeMatchPlayerStats(myStats, opponentStats);
    expect(result?.breakPointsWon).toBe(2);
    expect(result?.breakPointChances).toBe(5);
    expect(result?.breakPointsFaced).toBe(4);
    expect(result?.breakPointsSaved).toBe(3);
  });
});
