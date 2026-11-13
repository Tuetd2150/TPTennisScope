import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getRankings } from '../api/rankings';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CountryBadge } from '../components/CountryBadge';
import { Skeleton, TableSkeleton, CardSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { Trophy, ArrowRight, Activity, Users } from 'lucide-react';

export function HomePage() {
  const { data: rankings, loading, error, refetch } = useApi(getRankings);

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const numberOne = rankings?.[0];
  const topTen = rankings?.slice(0, 10);

  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-r from-surface-elevated to-surface-hover rounded-card p-8 border border-surface-border">
        <h1 className="text-4xl font-extrabold text-text-primary mb-4 tracking-tight">
          ATP Analytics, <span className="text-accent">Clearly Understood</span>
        </h1>
        <p className="text-text-secondary max-w-2xl text-lg mb-8">
          Deep dive into player statistics, head-to-head comparisons, and real-time ATP tour rankings.
        </p>
        <div className="flex gap-4">
          <Link to="/rankings" className="inline-flex items-center gap-2 bg-accent text-surface font-semibold px-5 py-2.5 rounded-badge hover:bg-accent-hover transition-colors">
            <Trophy size={20} /> View Rankings
          </Link>
          <Link to="/compare" className="inline-flex items-center gap-2 bg-surface-card text-text-primary border border-surface-border font-semibold px-5 py-2.5 rounded-badge hover:bg-surface-hover transition-colors">
            <Users size={20} /> Compare Players
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1"><CardSkeleton /></div>
          <div className="lg:col-span-2"><TableSkeleton rows={5} cols={3} /></div>
        </div>
      ) : rankings?.length === 0 ? (
        <EmptyState title="No rankings found" message="Sync data from the backend to view player rankings." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="text-accent" /> Current World #1</h2>
            {numberOne && (
              <Link to={`/players/${numberOne.player.id}`} className="block bg-surface-card rounded-card p-6 border border-surface-border hover:border-accent transition-colors group">
                <div className="flex items-center gap-4 mb-4">
                  <PlayerAvatar name={numberOne.player.name} imagePath={numberOne.player.imagePath} size="xl" />
                </div>
                <div>
                  <div className="text-accent font-mono text-sm mb-1">Rank #1</div>
                  <h3 className="text-2xl font-bold text-text-primary group-hover:text-accent transition-colors">{numberOne.player.name}</h3>
                  <div className="flex items-center gap-2 text-text-secondary mt-1">
                    <CountryBadge countryCode={numberOne.player.countryCode} showCode flagSize="md" />
                    <span>•</span>
                    <span>{numberOne.points.toLocaleString()} pts</span>
                  </div>
                </div>
              </Link>
            )}
            <div className="bg-surface-card rounded-card p-6 border border-surface-border">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity className="text-accent" /> Data Freshness</h3>
              <div className="text-sm text-text-secondary">
                <p>Last updated: <span className="text-text-primary font-medium">{numberOne?.rankingDate ? new Date(numberOne.rankingDate).toLocaleDateString() : 'N/A'}</span></p>
                <p className="mt-2 text-xs">Live rankings automatically updated.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Top 10 Players</h2>
              <Link to="/rankings" className="text-accent text-sm font-medium hover:underline flex items-center gap-1">
                View Full Top 100 <ArrowRight size={16} />
              </Link>
            </div>
            <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-elevated text-text-muted text-xs uppercase border-b border-surface-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Rank</th>
                      <th className="px-6 py-4 font-medium">Player</th>
                      <th className="px-6 py-4 font-medium text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {topTen?.map((entry) => (
                      <tr key={entry.player.id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono">
                          {entry.rank === 1 ? <span className="text-accent font-bold">1</span> : entry.rank}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link to={`/players/${entry.player.id}`} className="flex items-center gap-3 group">
                            <PlayerAvatar name={entry.player.name} imagePath={entry.player.imagePath} size="sm" />
                            <div>
                              <span className="font-semibold text-text-primary group-hover:text-accent transition-colors block">
                                {entry.player.name}
                              </span>
                              <div className="text-xs text-text-secondary mt-0.5">
                                <CountryBadge countryCode={entry.player.countryCode} showCode flagSize="sm" />
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-medium">
                          {entry.points.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
