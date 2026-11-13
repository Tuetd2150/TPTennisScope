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

const IOC_TO_ISO2: Record<string, string> = {
  GER: 'DE',
  AUT: 'AT',
  CRO: 'HR',
  DEN: 'DK',
  SUI: 'CH',
  NED: 'NL',
  POR: 'PT',
  BUL: 'BG',
  CHI: 'CL',
  RSA: 'ZA',
  LAT: 'LV',
  GRE: 'GR',
  SRB: 'RS',
  BIH: 'BA',
  MON: 'MC',
  SLO: 'SI',
  SVK: 'SK',
  SWE: 'SE',
  NOR: 'NO',
  FIN: 'FI',
  POL: 'PL',
  HUN: 'HU',
  ROU: 'RO',
  CZE: 'CZ',
  GBR: 'GB',
  RUS: 'RU',
  UKR: 'UA',
  BLR: 'BY',
  KAZ: 'KZ',
  GEO: 'GE',
  ARM: 'AM',
  ISR: 'IL',
  TUR: 'TR',
  CYP: 'CY',
  USA: 'US',
  CAN: 'CA',
  MEX: 'MX',
  BRA: 'BR',
  ARG: 'AR',
  COL: 'CO',
  PER: 'PE',
  ECU: 'EC',
  URU: 'UY',
  PAR: 'PY',
  BOL: 'BO',
  VEN: 'VE',
  AUS: 'AU',
  NZL: 'NZ',
  JPN: 'JP',
  CHN: 'CN',
  KOR: 'KR',
  TPE: 'TW',
  IND: 'IN',
  THA: 'TH',
  INA: 'ID',
  PHI: 'PH',
  VIE: 'VN',
  EGY: 'EG',
  TUN: 'TN',
  MAR: 'MA',
  ALG: 'DZ',
  ESP: 'ES',
  FRA: 'FR',
  ITA: 'IT',
  BEL: 'BE',
  IRL: 'IE',
  LUX: 'LU',
};

export function getCountryIso2(countryCode: string | null | undefined): string | null {
  if (!countryCode || countryCode.trim() === '') return null;
  const clean = countryCode.trim().toUpperCase();

  const iso2 = IOC_TO_ISO2[clean] || (clean.length === 2 ? clean : clean.slice(0, 2));

  if (!/^[A-Z]{2}$/.test(iso2)) {
    return null;
  }

  return iso2.toLowerCase();
}

export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.trim() === '') return '🏳️';
  const clean = countryCode.trim().toUpperCase();

  // Resolve 3-letter IOC code to 2-letter ISO 3166-1 alpha-2 code
  const iso2 = IOC_TO_ISO2[clean] || (clean.length === 2 ? clean : clean.slice(0, 2));

  if (!/^[A-Z]{2}$/.test(iso2)) {
    return '🏳️';
  }

  const offset = 0x1F1E6;
  return String.fromCodePoint(
    iso2.charCodeAt(0) - 65 + offset,
    iso2.charCodeAt(1) - 65 + offset
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
