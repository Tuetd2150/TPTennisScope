export function calcPercentage(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

export function firstServePct(firstServe: number | null | undefined, firstServeOf: number | null | undefined): number | null {
  return calcPercentage(firstServe, firstServeOf);
}

export function firstServePointsWonPct(won: number | null | undefined, total: number | null | undefined): number | null {
  return calcPercentage(won, total);
}

export function secondServePointsWonPct(won: number | null | undefined, total: number | null | undefined): number | null {
  return calcPercentage(won, total);
}

export function breakPointsSavedPct(saved: number | null | undefined, faced: number | null | undefined): number | null {
  return calcPercentage(saved, faced);
}

export function breakPointsConvertedPct(won: number | null | undefined, chances: number | null | undefined): number | null {
  return calcPercentage(won, chances);
}

export function netPointsWonPct(won: number | null | undefined, total: number | null | undefined): number | null {
  return calcPercentage(won, total);
}

export function winPercentage(wins: number | null | undefined, losses: number | null | undefined): number | null {
  if (wins == null || losses == null) return null;
  const total = wins + losses;
  if (total === 0) return null;
  return (wins / total) * 100;
}

export function isSinglesMatch(player1Name: string, player2Name: string): boolean {
  return !player1Name.includes('/') && !player2Name.includes('/');
}

export function parseAge(birthday: string | Date | null | undefined): number | null {
  if (!birthday) return null;
  const birthDate = birthday instanceof Date ? birthday : new Date(birthday);
  if (isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function parseHandAndBackhand(plays: string | null | undefined): { hand: 'RIGHT' | 'LEFT' | 'UNKNOWN'; backhand: 'ONE_HANDED' | 'TWO_HANDED' | 'UNKNOWN' } {
  if (!plays) return { hand: 'UNKNOWN', backhand: 'UNKNOWN' };
  const lower = plays.toLowerCase();
  let hand: 'RIGHT' | 'LEFT' | 'UNKNOWN' = 'UNKNOWN';
  let backhand: 'ONE_HANDED' | 'TWO_HANDED' | 'UNKNOWN' = 'UNKNOWN';
  if (lower.includes('right')) hand = 'RIGHT';
  else if (lower.includes('left')) hand = 'LEFT';
  if (lower.includes('two-handed') || lower.includes('two handed')) backhand = 'TWO_HANDED';
  else if (lower.includes('one-handed') || lower.includes('one handed')) backhand = 'ONE_HANDED';
  return { hand, backhand };
}

export function parseHeight(height: string | number | null | undefined): number | null {
  if (height == null) return null;
  if (typeof height === 'number') return height;
  const match = height.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function parseWeight(weight: string | number | null | undefined): number | null {
  if (weight == null) return null;
  if (typeof weight === 'number') return weight;
  const match = weight.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function formatStatValue(value: number | null | undefined, decimals: number = 1): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}

export function normalizeSurface(rawSurface: string | number | null | undefined, tournamentName?: string | null): string | null {
  if (rawSurface != null && String(rawSurface).trim() !== '') {
    const str = String(rawSurface).toLowerCase().trim();
    if (str.includes('clay') || str === '2' || str === 'clay court') return 'Clay';
    if (str.includes('grass') || str === '4' || str === '5' || str === 'grass court') return 'Grass';
    if (str.includes('hard') || str.includes('carpet') || str.includes('indoor') || str === '1' || str === '3') return 'Hard';
  }

  if (tournamentName) {
    const tName = tournamentName.toLowerCase();
    // Check Clay tournaments first (so "French Open - Paris" is Clay, not Hard from "paris")
    if (
      tName.includes('roland garros') ||
      tName.includes('french open') ||
      tName.includes('clay') ||
      tName.includes('monte carlo') ||
      tName.includes('monte-carlo') ||
      tName.includes('rome') ||
      tName.includes('roma') ||
      tName.includes('madrid') ||
      tName.includes('barcelona') ||
      tName.includes('bastad') ||
      tName.includes('umag') ||
      tName.includes('gstaad') ||
      tName.includes('rio') ||
      tName.includes('estoril') ||
      tName.includes('geneva') ||
      tName.includes('kitzbuhel')
    ) {
      return 'Clay';
    }

    // Check Grass tournaments
    if (
      tName.includes('wimbledon') ||
      tName.includes('grass') ||
      tName.includes('halle') ||
      tName.includes('queen') ||
      tName.includes('stuttgart') ||
      tName.includes('eastbourne') ||
      tName.includes('s-hertogenbosch') ||
      tName.includes('mallorca') ||
      tName.includes('newport')
    ) {
      return 'Grass';
    }

    // Check Hard tournaments
    if (
      tName.includes('australian open') ||
      tName.includes('us open') ||
      tName.includes('hard') ||
      tName.includes('miami') ||
      tName.includes('indian wells') ||
      tName.includes('cincinnati') ||
      tName.includes('shanghai') ||
      tName.includes('beijing') ||
      tName.includes('rotterdam') ||
      tName.includes('doha') ||
      tName.includes('dubai') ||
      tName.includes('vienna') ||
      tName.includes('basel') ||
      tName.includes('paris') ||
      tName.includes('turin') ||
      tName.includes('atp finals')
    ) {
      return 'Hard';
    }
  }

  return null;
}

