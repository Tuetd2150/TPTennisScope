import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getRankings } from '../api/rankings';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CountryFlag } from '../components/CountryFlag';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { Search } from 'lucide-react';

export function RankingsPage() {
  const { data: rankings, loading, error, refetch } = useApi(getRankings);
  const [search, setSearch] = useState('');

  const filteredRankings = useMemo(() => {
    if (!rankings) return [];
    if (!search.trim()) return rankings;
    const lowerSearch = search.toLowerCase();
    return rankings.filter(entry => 
      entry.player.name.toLowerCase().includes(lowerSearch) ||
      (entry.player.countryCode && entry.player.countryCode.toLowerCase().includes(lowerSearch))
    );
  }, [rankings, search]);

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const latestDate = rankings?.[0]?.rankingDate;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">ATP Singles Rankings</h1>
          {latestDate && (
            <p className="text-sm text-text-secondary mt-1">
              As of {new Date(latestDate).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 bg-surface-elevated border border-surface-border rounded-badge py-2 pl-9 pr-4 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-surface-card rounded-card border border-surface-border p-6">
          <TableSkeleton rows={20} cols={4} />
        </div>
      ) : filteredRankings.length === 0 ? (
        <EmptyState title="No players found" message="Try a different search term or check if ranking data is synced." />
      ) : (
        <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-elevated text-text-muted text-xs uppercase border-b border-surface-border sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-medium w-16 text-center">Rank</th>
                  <th className="px-6 py-4 font-medium">Player</th>
                  <th className="px-6 py-4 font-medium w-24">Age</th>
                  <th className="px-6 py-4 font-medium text-right w-32">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredRankings.map((entry) => (
                  <tr key={entry.player.id} className="hover:bg-surface-hover transition-colors group cursor-pointer" onClick={() => window.location.href=`/players/${entry.player.id}`}>
                    <td className="px-6 py-4 font-mono text-center">
                      {entry.rank === 1 ? <span className="text-accent font-bold">1</span> : entry.rank}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <PlayerAvatar name={entry.player.name} imagePath={entry.player.imagePath} size="md" />
                        <div>
                          <div className="font-semibold text-text-primary group-hover:text-accent transition-colors text-base">
                            {entry.player.name}
                          </div>
                          <div className="text-xs text-text-secondary mt-1">
                            <CountryFlag countryCode={entry.player.countryCode} showCode />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {entry.player.age ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium">
                      {entry.points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
