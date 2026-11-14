import { describe, it, expect } from 'vitest';
import { buildApiBaseUrl } from '../src/api/apiClient';

describe('Frontend API Base URL Normalizer', () => {
  it('should fallback to "/api" when input is empty or undefined', () => {
    expect(buildApiBaseUrl('')).toBe('/api');
    expect(buildApiBaseUrl('   ')).toBe('/api');
    expect(buildApiBaseUrl(undefined)).toBe('/api');
  });

  it('should append "/api" when provided a domain without trailing slash', () => {
    expect(buildApiBaseUrl('http://localhost:5000')).toBe('http://localhost:5000/api');
    expect(buildApiBaseUrl('https://tennisscope-api.vercel.app')).toBe('https://tennisscope-api.vercel.app/api');
  });

  it('should strip trailing slash and append "/api"', () => {
    expect(buildApiBaseUrl('http://localhost:5000/')).toBe('http://localhost:5000/api');
    expect(buildApiBaseUrl('https://tennisscope-api.vercel.app/')).toBe('https://tennisscope-api.vercel.app/api');
  });

  it('should not duplicate "/api" if url already ends with "/api"', () => {
    expect(buildApiBaseUrl('http://localhost:5000/api')).toBe('http://localhost:5000/api');
    expect(buildApiBaseUrl('http://localhost:5000/api/')).toBe('http://localhost:5000/api');
    expect(buildApiBaseUrl('https://tennisscope-api.vercel.app/api')).toBe('https://tennisscope-api.vercel.app/api');
    expect(buildApiBaseUrl('/api')).toBe('/api');
    expect(buildApiBaseUrl('/api/')).toBe('/api');
  });
});
