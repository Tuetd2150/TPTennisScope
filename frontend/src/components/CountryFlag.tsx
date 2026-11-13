import { CountryBadge } from './CountryBadge';

export function CountryFlag({
  countryCode,
  showCode = true,
}: {
  countryCode: string | null | undefined;
  showCode?: boolean;
}) {
  return <CountryBadge countryCode={countryCode} showCode={showCode} />;
}
