import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { formatStat, formatWL, getCountryIso2, getCountryFlag, getSurfaceColor } from '../src/utils/format';
import { CountryBadge } from '../src/components/CountryBadge';

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

  it('maps ATP 3-letter codes to lowercase ISO-2 correctly for all 12 required nations', () => {
    const testCases: Record<string, string> = {
      GER: 'de',
      ITA: 'it',
      ESP: 'es',
      USA: 'us',
      AUT: 'at',
      CRO: 'hr',
      DEN: 'dk',
      SUI: 'ch',
      NED: 'nl',
      GBR: 'gb',
      FRA: 'fr',
      RUS: 'ru',
    };

    for (const [code, expectedIso2] of Object.entries(testCases)) {
      expect(getCountryIso2(code)).toBe(expectedIso2);
      // Handles lowercase & whitespace gracefully
      expect(getCountryIso2(code.toLowerCase())).toBe(expectedIso2);
      expect(getCountryIso2(` ${code} `)).toBe(expectedIso2);
    }

    // Fallbacks
    expect(getCountryIso2(null)).toBeNull();
    expect(getCountryIso2(undefined)).toBeNull();
    expect(getCountryIso2('')).toBeNull();
    expect(getCountryIso2('   ')).toBeNull();
  });

  it('returns surface color classes', () => {
    expect(getSurfaceColor('Hard')).toContain('hard');
    expect(getSurfaceColor('Clay')).toContain('clay');
    expect(getSurfaceColor('Grass')).toContain('grass');
  });
});

describe('CountryBadge Component (SVG / CSS flag-icons)', () => {
  const nations12: Array<{ code: string; iso2: string; forbidden2LetterText: string }> = [
    { code: 'GER', iso2: 'de', forbidden2LetterText: 'DE' },
    { code: 'ITA', iso2: 'it', forbidden2LetterText: 'IT' },
    { code: 'ESP', iso2: 'es', forbidden2LetterText: 'ES' },
    { code: 'USA', iso2: 'us', forbidden2LetterText: 'US' },
    { code: 'AUT', iso2: 'at', forbidden2LetterText: 'AU' },
    { code: 'CRO', iso2: 'hr', forbidden2LetterText: 'CR' },
    { code: 'DEN', iso2: 'dk', forbidden2LetterText: 'DK' },
    { code: 'SUI', iso2: 'ch', forbidden2LetterText: 'CH' },
    { code: 'NED', iso2: 'nl', forbidden2LetterText: 'NL' },
    { code: 'GBR', iso2: 'gb', forbidden2LetterText: 'GB' },
    { code: 'FRA', iso2: 'fr', forbidden2LetterText: 'FR' },
    { code: 'RUS', iso2: 'ru', forbidden2LetterText: 'RU' },
  ];

  it('renders all 12 nations with flag-icons CSS class fi-{iso2} and 3-letter code, NEVER rendering 2-letter ISO text', () => {
    for (const { code, iso2, forbidden2LetterText } of nations12) {
      const html = renderToStaticMarkup(React.createElement(CountryBadge, { countryCode: code, showCode: true }));

      // Must contain flag-icons class fi and fi-{iso2}
      expect(html).toContain(`fi fi-${iso2}`);

      // Must contain 3-letter code in text span
      expect(html).toContain(`>${code}</span>`);

      // Must have flex alignment and gap
      expect(html).toContain('inline-flex items-center gap-1.5');

      // Crucial: The rendered text must NOT be a 2-letter code
      expect(html).not.toContain(`>${forbidden2LetterText}</span>`);

      // Must NOT contain Unicode emoji flag
      expect(html).not.toContain('🇩🇪');
      expect(html).not.toContain('🇮🇹');
      expect(html).not.toContain('🇪🇸');
      expect(html).not.toContain('🇺🇸');
    }
  });

  it('renders neutral SVG fallback when countryCode is missing or empty, never rendering broken emoji', () => {
    const cases = [null, undefined, '', '   '];
    for (const val of cases) {
      const html = renderToStaticMarkup(React.createElement(CountryBadge, { countryCode: val, showCode: true }));

      // Must render SVG neutral icon
      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 16 12"');

      // Must render text fallback
      expect(html).toContain('—');
      expect(html).toContain('inline-flex items-center gap-1.5');

      // Must NOT render Unicode emoji 🏳️
      expect(html).not.toContain('🏳️');
    }
  });
});
