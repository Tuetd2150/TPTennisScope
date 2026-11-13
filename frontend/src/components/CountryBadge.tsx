import { getCountryIso2 } from '../utils/format';

export interface CountryBadgeProps {
  countryCode: string | null | undefined;
  className?: string;
  flagSize?: 'sm' | 'md' | 'lg';
  showCode?: boolean;
}

export function CountryBadge({
  countryCode,
  className = '',
  flagSize = 'md',
  showCode = true,
}: CountryBadgeProps) {
  const code = countryCode?.trim().toUpperCase() || null;
  const iso2 = getCountryIso2(code);

  const flagSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  if (!code || !iso2) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-text-muted ${className}`}>
        <svg
          className="w-4 h-3 text-text-muted/60 flex-shrink-0 inline-block"
          viewBox="0 0 16 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Neutral flag"
        >
          <rect width="16" height="12" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M4 3.5V9.5M4 3.5H9.5C10.5 3.5 11 4.5 12 4.5V7C11 7 10.5 6 9.5 6H4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {showCode && <span className="font-mono text-xs uppercase text-text-muted">—</span>}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${className}`}>
      <span
        className={`fi fi-${iso2} ${flagSizes[flagSize]} !bg-cover rounded-[2px] shadow-xs flex-shrink-0 inline-block overflow-hidden border border-white/10`}
        role="img"
        aria-label={code}
        title={code}
      />
      {showCode && (
        <span className="font-mono text-xs text-text-secondary tracking-wider uppercase font-semibold">
          {code}
        </span>
      )}
    </span>
  );
}
