import { getCountryFlag } from '../utils/format';

export function CountryFlag({ countryCode, showCode = false }: { countryCode: string | null | undefined; showCode?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-lg">{getCountryFlag(countryCode)}</span>
      {showCode && countryCode && <span className="text-text-secondary text-sm">{countryCode}</span>}
    </span>
  );
}
