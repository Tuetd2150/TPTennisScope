import axios from 'axios';

/**
 * Normalizes the API base URL to ensure clean, consistent routing.
 * - Empty/undefined defaults to '/api' (Vite proxy in local dev).
 * - Strips trailing slashes.
 * - Guarantees the path ends with '/api' without duplicate '/api/api'.
 */
export function buildApiBaseUrl(rawUrl?: string): string {
  if (!rawUrl || rawUrl.trim() === '') {
    return '/api';
  }

  const trimmed = rawUrl.trim().replace(/\/+$/, '');

  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

const API_BASE_URL = buildApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message || error.message || 'An error occurred';
    console.error(`API Error: ${message}`);
    return Promise.reject(error);
  }
);
