export function formatStat(value: number | null | undefined, decimals: number = 1, suffix: string = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals)}${suffix}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatWL(wins: number | null | undefined, losses: number | null | undefined): string {
  if (wins == null && losses == null) return '—';
  return `${wins ?? 0}-${losses ?? 0}`;
}

export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length < 2) return '🏳️';
  const code = countryCode.slice(0, 2).toUpperCase();
  const offset = 0x1F1E6;
  return String.fromCodePoint(
    code.charCodeAt(0) - 65 + offset,
    code.charCodeAt(1) - 65 + offset
  );
}

export function getSurfaceColor(surface: string | null | undefined): string {
  if (!surface) return 'bg-surface-border text-text-secondary';
  const s = surface.toLowerCase();
  if (s.includes('clay')) return 'bg-clay/20 text-clay-light';
  if (s.includes('grass')) return 'bg-grass/20 text-grass-light';
  if (s.includes('indoor')) return 'bg-indoor/20 text-indoor-light';
  if (s.includes('hard')) return 'bg-hard/20 text-hard-light';
  return 'bg-surface-border text-text-secondary';
}

export function getPlayerImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return '';
  return `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '')}/api/images/players/${imagePath}`;
}
