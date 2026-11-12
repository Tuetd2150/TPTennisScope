import { describe, it, expect } from 'vitest';
import { 
  calcPercentage, 
  winPercentage, 
  isSinglesMatch, 
  parseHandAndBackhand, 
  parseHeight, 
  parseWeight, 
  parseAge 
} from '../src/utils/tennisStats';

describe('tennisStats utilities', () => {
  it('calcPercentage', () => {
    expect(calcPercentage(50, 100)).toBe(50);
    expect(calcPercentage(null, 100)).toBe(null);
    expect(calcPercentage(50, 0)).toBe(null);
  });

  it('winPercentage', () => {
    expect(winPercentage(3, 1)).toBe(75);
    expect(winPercentage(0, 0)).toBe(null);
    expect(winPercentage(null, 1)).toBe(null);
  });

  it('isSinglesMatch', () => {
    expect(isSinglesMatch('Federer', 'Nadal')).toBe(true);
    expect(isSinglesMatch('Federer / Nadal', 'Djokovic / Murray')).toBe(false);
  });

  it('parseHandAndBackhand', () => {
    expect(parseHandAndBackhand('Right-Handed, Two-Handed Backhand')).toEqual({ hand: 'RIGHT', backhand: 'TWO_HANDED' });
    expect(parseHandAndBackhand('Left, One handed')).toEqual({ hand: 'LEFT', backhand: 'ONE_HANDED' });
    expect(parseHandAndBackhand(null)).toEqual({ hand: 'UNKNOWN', backhand: 'UNKNOWN' });
  });

  it('parseHeight and parseWeight', () => {
    expect(parseHeight('185 cm')).toBe(185);
    expect(parseHeight(185)).toBe(185);
    expect(parseHeight(null)).toBe(null);

    expect(parseWeight('80 kg')).toBe(80);
    expect(parseWeight(80)).toBe(80);
  });

  it('parseAge', () => {
    expect(parseAge(new Date('1990-01-01'))).toBeGreaterThan(30);
    expect(parseAge(null)).toBe(null);
  });
});
