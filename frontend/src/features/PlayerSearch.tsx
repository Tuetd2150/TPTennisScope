import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { getRankings } from '../api/rankings';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CountryBadge } from '../components/CountryBadge';

export function PlayerSearch({ label, value, onChange, disabledId }: { label: string; value: number | null; onChange: (id: number) => void; disabledId?: number | null }) {
  const { data: rankings } = useApi(getRankings);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedPlayer = rankings?.find(r => r.player.id === value)?.player;

  const filtered = rankings?.filter(r => 
    r.player.id !== disabledId && 
    r.player.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10) || [];

  return (
    <div className="relative">
      <label className="block text-xs uppercase tracking-wider text-text-muted mb-2">{label}</label>
      
      {selectedPlayer && !isOpen ? (
        <div 
          className="flex items-center justify-between p-3 bg-surface-card border border-surface-border rounded-card cursor-pointer hover:border-accent transition-colors"
          onClick={() => setIsOpen(true)}
        >
          <div className="flex items-center gap-3">
            <PlayerAvatar name={selectedPlayer.name} imagePath={selectedPlayer.imagePath} size="sm" />
            <span className="font-semibold text-text-primary">{selectedPlayer.name}</span>
            <CountryBadge countryCode={selectedPlayer.countryCode} flagSize="sm" showCode />
          </div>
          <span className="text-xs text-text-secondary">Change</span>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            className="w-full bg-surface-card border border-accent rounded-card p-3 pl-4 text-text-primary focus:outline-none"
            placeholder="Search player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            autoFocus={isOpen && !!selectedPlayer}
          />
          {isOpen && filtered.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-elevated border border-surface-border rounded-card max-h-60 overflow-y-auto shadow-xl">
              {filtered.map(r => (
                <div
                  key={r.player.id}
                  className="flex items-center gap-3 p-3 hover:bg-surface-hover cursor-pointer transition-colors"
                  onClick={() => {
                    onChange(r.player.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <PlayerAvatar name={r.player.name} imagePath={r.player.imagePath} size="sm" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{r.player.name}</span>
                      <CountryBadge countryCode={r.player.countryCode} flagSize="sm" showCode />
                    </div>
                    <div className="text-xs text-text-secondary">Rank #{r.rank}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
