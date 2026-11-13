import { describe, it, expect, afterEach } from 'vitest';
import { normalizeCountryCode } from '../src/utils/country';
import { playerRepository } from '../src/modules/players/player.repository';
import { prisma } from '../src/config/database';

describe('Country Normalization & Data Precedence', () => {
  const TEST_PLAYER_ID = 999990;

  afterEach(async () => {
    await prisma.player.deleteMany({
      where: { externalId: TEST_PLAYER_ID },
    });
  });

  describe('normalizeCountryCode utility', () => {
    it('normalizes 2 and 3 letter uppercase country codes', () => {
      expect(normalizeCountryCode('GER')).toBe('GER');
      expect(normalizeCountryCode('ita')).toBe('ITA');
      expect(normalizeCountryCode(' esp ')).toBe('ESP');
      expect(normalizeCountryCode('US')).toBe('US');
    });

    it('returns null for invalid or missing inputs', () => {
      expect(normalizeCountryCode(null)).toBeNull();
      expect(normalizeCountryCode(undefined)).toBeNull();
      expect(normalizeCountryCode('')).toBeNull();
      expect(normalizeCountryCode('   ')).toBeNull();
      expect(normalizeCountryCode('GERMANY')).toBeNull(); // Full names must not pass as codes
      expect(normalizeCountryCode('123')).toBeNull();
    });
  });

  describe('Country Precedence Rules in Player Repository', () => {
    it('Precedence #1: Ranking provider payload sets countryCode for new player', async () => {
      const player = await playerRepository.upsertFromRanking(TEST_PLAYER_ID, {
        name: 'Test Ranking Player',
        countryCode: 'GER',
      });

      expect(player.countryCode).toBe('GER');
    });

    it('Precedence #1: Ranking provider payload updates countryCode if authoritative ranking country is provided', async () => {
      // Player initially has unverified or legacy country
      await prisma.player.create({
        data: {
          externalId: TEST_PLAYER_ID,
          name: 'Player Legacy',
          countryCode: 'ITA',
        },
      });

      // Ranking sync arrives with official country GER
      const updated = await playerRepository.upsertFromRanking(TEST_PLAYER_ID, {
        name: 'Player Legacy',
        countryCode: 'GER',
      });

      expect(updated.countryCode).toBe('GER');
    });

    it('Precedence #3: Ranking sync preserves existing countryCode if ranking payload has null country', async () => {
      await prisma.player.create({
        data: {
          externalId: TEST_PLAYER_ID,
          name: 'Existing Country Player',
          countryCode: 'ESP',
        },
      });

      // Ranking arrives with null country
      const updated = await playerRepository.upsertFromRanking(TEST_PLAYER_ID, {
        name: 'Existing Country Player',
        countryCode: null,
      });

      expect(updated.countryCode).toBe('ESP');
    });

    it('Precedence #4: Minimal Match/Results data MUST NOT overwrite an existing trusted countryCode', async () => {
      // Player exists with trusted countryCode "GER"
      await prisma.player.create({
        data: {
          externalId: TEST_PLAYER_ID,
          name: 'Target Player',
          countryCode: 'GER',
        },
      });

      // Minimal match sync processes opponent or p1/p2 with conflicting country code "ITA"
      await playerRepository.upsertFromExternal(TEST_PLAYER_ID, {
        externalId: TEST_PLAYER_ID,
        name: 'Target Player',
        countryCode: 'ITA',
      });

      const refreshed = await prisma.player.findUnique({
        where: { externalId: TEST_PLAYER_ID },
      });

      // CountryCode MUST remain "GER"
      expect(refreshed?.countryCode).toBe('GER');
    });

    it('Precedence #4: Minimal Match/Results data sets countryCode ONLY if player currently has none (null)', async () => {
      // Player exists with null countryCode
      await prisma.player.create({
        data: {
          externalId: TEST_PLAYER_ID,
          name: 'New Opponent',
          countryCode: null,
        },
      });

      // Minimal match sync arrives with countryCode "FRA"
      await playerRepository.upsertFromExternal(TEST_PLAYER_ID, {
        externalId: TEST_PLAYER_ID,
        name: 'New Opponent',
        countryCode: 'FRA',
      });

      const refreshed = await prisma.player.findUnique({
        where: { externalId: TEST_PLAYER_ID },
      });

      expect(refreshed?.countryCode).toBe('FRA');
    });

    it('Precedence #2: Profile payload updates countryCode, or preserves existing if profile country is null', async () => {
      await prisma.player.create({
        data: {
          externalId: TEST_PLAYER_ID,
          name: 'Profile Target',
          countryCode: 'USA',
        },
      });

      // Full profile sync arrives with countryCode null
      await playerRepository.upsertFullProfile(TEST_PLAYER_ID, {
        externalId: TEST_PLAYER_ID,
        name: 'Profile Target',
        countryCode: null,
      });

      const afterNullProfile = await prisma.player.findUnique({
        where: { externalId: TEST_PLAYER_ID },
      });
      // Preserved existing
      expect(afterNullProfile?.countryCode).toBe('USA');

      // Full profile arrives with new authoritative country
      await playerRepository.upsertFullProfile(TEST_PLAYER_ID, {
        externalId: TEST_PLAYER_ID,
        name: 'Profile Target',
        countryCode: 'CAN',
      });

      const afterCanProfile = await prisma.player.findUnique({
        where: { externalId: TEST_PLAYER_ID },
      });
      expect(afterCanProfile?.countryCode).toBe('CAN');
    });
  });
});
