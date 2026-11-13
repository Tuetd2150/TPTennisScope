import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('API Endpoints', () => {
  it('GET /api/health should return 200 ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/rankings should return 200 and serve accurate country codes', async () => {
    const res = await request(app).get('/api/rankings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const rank1 = res.body[0];
      if (rank1.player?.externalId === 24008) {
        expect(rank1.player.countryCode).toBe('GER');
      }
    }
  });

  it('GET /api/players/999999 should return 404', async () => {
    const res = await request(app).get('/api/players/999999');
    expect(res.status).toBe(404);
  });
});
