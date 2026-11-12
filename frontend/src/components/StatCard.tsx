export function StatCard({ label, value, subValue, accent = false }: { label: string; value: string | number; subValue?: string; accent?: boolean }) {
  return (
    <div className="bg-surface-card rounded-card p-4 border border-surface-border">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
      {subValue && <p className="text-sm text-text-secondary mt-0.5">{subValue}</p>}
    </div>
  );
}
