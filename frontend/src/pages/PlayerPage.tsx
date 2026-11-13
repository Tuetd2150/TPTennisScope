import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getPlayer, getPlayerSeasonStats, getPlayerMatches } from '../api/players';
import { getRankingHistory } from '../api/rankings';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CountryBadge } from '../components/CountryBadge';
import { CountryFlag } from '../components/CountryFlag';
import { StatCard } from '../components/StatCard';
import { SurfaceBadge } from '../components/SurfaceBadge';
import { Skeleton, CardSkeleton, TableSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { formatStat, formatDate, formatWL } from '../utils/format';
import { Trophy, ArrowLeft, Activity, Target, Zap, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);

  const { data: player, loading: pLoading, error: pError } = useApi(() => getPlayer(playerId), [playerId]);
  const { data: stats, loading: sLoading } = useApi(() => getPlayerSeasonStats(playerId, 2026), [playerId]);
  const { data: matches, loading: mLoading } = useApi(() => getPlayerMatches(playerId, 10), [playerId]);
  const { data: history, loading: hLoading } = useApi(() => getRankingHistory(playerId), [playerId]);

  if (pError) return <ErrorState message={pError} />;
  if (pLoading || !player) {
    return (
      <div className="space-y-8">
        <CardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><CardSkeleton /><CardSkeleton /></div>
      </div>
    );
  }

  const { careerStats, titles } = player;

  const grandSlams = titles.filter(
  t =>
    t.tourRankId === 4 ||
    t.tourRankName?.toLowerCase().includes('grand slam')
  );

  const atpFinals = titles.filter(
    t =>
      t.tourRankId === 7 ||
      t.tourRankName?.toLowerCase().includes('tour finals')
  );

  const masters = titles.filter(
    t =>
      t.tourRankId === 3 ||
      t.tourRankName?.toLowerCase().includes('masters')
  );

  const otherTitles = titles.filter(
    t =>
      t.tourRankId === 2 ||
      t.tourRankName?.toLowerCase() === 'main tour'
  );

  const teamComps = titles.filter(
    t =>
      t.tourRankId === 5 ||
      t.isTeamCompetition
);

  const formatRankTooltip = (value: number, name: string) => [value, name === 'rank' ? 'Rank' : name];
  const formatRankDate = (val: string) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-8">
      <Link to="/rankings" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent transition-colors text-sm font-medium">
        <ArrowLeft size={16} /> Back to Rankings
      </Link>

      {/* Hero */}
      <section className="bg-surface-elevated rounded-card p-6 md:p-8 border border-surface-border flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <PlayerAvatar name={player.name} imagePath={player.imagePath} size="xl" />
        <div className="flex-1 text-center md:text-left z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-text-primary mb-2">{player.name}</h1>
              <div className="flex items-center justify-center md:justify-start gap-3 text-lg text-text-secondary">
                <CountryFlag countryCode={player.countryCode} showCode />
                {player.age && <span>• {player.age} yrs</span>}
                {player.status && <span className="px-2 py-0.5 bg-surface-hover rounded-badge text-xs font-medium uppercase tracking-wider">{player.status}</span>}
              </div>
            </div>
            <div className="bg-surface-card rounded-card p-4 border border-surface-border text-center min-w-[140px]">
              <div className="text-xs text-text-muted uppercase tracking-wider mb-1">ATP Rank</div>
              <div className="text-4xl font-bold text-accent">{player.currentRank ?? '—'}</div>
              <div className="text-sm text-text-secondary mt-1">{player.currentPoints ? `${player.currentPoints.toLocaleString()} pts` : '— pts'}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Bio */}
          <section className="bg-surface-card rounded-card p-6 border border-surface-border">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">Personal Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-text-muted block text-xs uppercase mb-1">Born</span><span className="text-text-primary">{formatDate(player.birthday)}</span></div>
              <div><span className="text-text-muted block text-xs uppercase mb-1">Birthplace</span><span className="text-text-primary">{player.birthplace || '—'}</span></div>
              <div><span className="text-text-muted block text-xs uppercase mb-1">Residence</span><span className="text-text-primary">{player.residence || '—'}</span></div>
              <div><span className="text-text-muted block text-xs uppercase mb-1">Turned Pro</span><span className="text-text-primary">{player.turnedPro || '—'}</span></div>
              <div><span className="text-text-muted block text-xs uppercase mb-1">Plays</span><span className="text-text-primary">{player.hand || '—'}</span></div>
              <div><span className="text-text-muted block text-xs uppercase mb-1">Backhand</span><span className="text-text-primary">{player.backhand || '—'}</span></div>
              <div><span className="text-text-muted block text-xs uppercase mb-1">Height / Weight</span><span className="text-text-primary">{player.heightCm ? `${player.heightCm}cm` : '—'} / {player.weightKg ? `${player.weightKg}kg` : '—'}</span></div>
              <div><span className="text-text-muted block text-xs uppercase mb-1">Coach</span><span className="text-text-primary">{player.coach || '—'}</span></div>
            </div>
          </section>

          {/* Career */}
          <section className="bg-surface-card rounded-card p-6 border border-surface-border">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">Career Stats</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <StatCard label="W-L" value={formatWL(careerStats?.careerWins, careerStats?.careerLosses)} />
              <StatCard label="Win %" value={careerStats?.careerWinPct ? `${careerStats.careerWinPct.toFixed(1)}%` : '—'} />
              <StatCard label="Titles" value={careerStats?.careerTitles ?? '—'} />
              <StatCard label="High Rank" value={player.careerHighRank ?? '—'} subValue={formatDate(player.careerHighDate)} />
            </div>
            
            {titles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider border-b border-surface-border pb-2">Trophy Cabinet</h3>
                {grandSlams.length > 0 && (
                  <div className="flex justify-between items-center bg-surface-hover p-3 rounded-badge">
                    <span className="text-sm font-medium">Grand Slams</span>
                    <span className="font-bold text-accent">{grandSlams.reduce((sum, t) => sum + t.titlesWon, 0)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center bg-surface-hover p-3 rounded-badge">
                  <span className="text-sm font-medium">ATP Finals</span>
                  <span className="font-bold text-text-primary">{atpFinals.reduce((sum, t) => sum + t.titlesWon, 0)}</span>
                </div>
                {masters.length > 0 && (
                  <div className="flex justify-between items-center bg-surface-hover p-3 rounded-badge">
                    <span className="text-sm font-medium">Masters 1000</span>
                    <span className="font-bold text-text-primary">{masters.reduce((sum, t) => sum + t.titlesWon, 0)}</span>
                  </div>
                )}
                {otherTitles.length > 0 && (
                  <div className="flex justify-between items-center bg-surface-hover p-3 rounded-badge">
                    <span className="text-sm font-medium">Main Tour Titles</span>
                    <span className="font-bold text-text-primary">{otherTitles.reduce((sum, t) => sum + t.titlesWon, 0)}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Season Stats */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Activity className="text-accent" /> 2026 Season</h2>
            {sLoading ? <CardSkeleton /> : !stats ? <div className="text-text-secondary p-4 bg-surface-card rounded-card">No season stats available.</div> : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Matches" value={stats.matches} />
                  <StatCard label="W-L" value={formatWL(stats.wins, stats.losses)} accent />
                  <StatCard label="Win %" value={stats.winPct ? `${stats.winPct.toFixed(1)}%` : '—'} />
                  <StatCard label="Aces" value={stats.serve.aces ?? '—'} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['Hard', 'Clay', 'Grass'].map(surf => {
                    const s = stats.surfaces.find(x => x.surface.toLowerCase() === surf.toLowerCase());
                    return (
                      <div key={surf} className="bg-surface-card border border-surface-border rounded-card p-4">
                        <div className="flex justify-between items-center mb-2">
                          <SurfaceBadge surface={surf} />
                          <span className="text-sm font-bold">{formatWL(s?.wins, s?.losses)}</span>
                        </div>
                        <div className="w-full bg-surface-hover h-2 rounded-full overflow-hidden">
                          <div className="bg-accent h-full" style={{ width: `${s?.winPct || 0}%` }} />
                        </div>
                        <div className="text-right text-xs text-text-muted mt-1">{s?.winPct ? `${s.winPct.toFixed(0)}%` : '0%'}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-card rounded-card p-5 border border-surface-border">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-text-secondary uppercase"><Target size={16}/> Serve Stats</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-text-muted">1st Serve %</span><span className="font-mono">{formatStat(stats.serve.firstServePct, 1, '%')}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">1st Serve Pts Won</span><span className="font-mono">{formatStat(stats.serve.firstServePointsWonPct, 1, '%')}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">2nd Serve Pts Won</span><span className="font-mono">{formatStat(stats.serve.secondServePointsWonPct, 1, '%')}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Break Pts Saved</span><span className="font-mono">{formatStat(stats.serve.breakPointsSavedPct, 1, '%')}</span></div>
                    </div>
                  </div>
                  <div className="bg-surface-card rounded-card p-5 border border-surface-border">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-text-secondary uppercase"><Zap size={16}/> Advanced</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-text-muted">Fastest Serve</span><span className="font-mono">{stats.advanced.fastestServe || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Avg 1st Serve Spd</span><span className="font-mono">{stats.advanced.averageFirstServeSpeed || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Avg 2nd Serve Spd</span><span className="font-mono">{stats.advanced.averageSecondServeSpeed || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Break Pts Converted</span><span className="font-mono">{formatStat(stats.serve.breakPointsConvertedPct, 1, '%')}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Ranking History */}
          <section className="bg-surface-card rounded-card p-6 border border-surface-border">
            <h2 className="text-lg font-bold mb-4">Ranking History (2026)</h2>
            {hLoading ? <Skeleton height="300px" /> : !history || history.length === 0 ? <div className="text-text-muted text-sm">No history available.</div> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice().reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" vertical={false} />
                    <XAxis dataKey="rankingDate" tickFormatter={formatRankDate} stroke="#8b949e" fontSize={12} tickMargin={10} />
                    <YAxis reversed stroke="#8b949e" fontSize={12} tickMargin={10} domain={['dataMin', 'dataMax + 10']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161b22', borderColor: '#2d333b', borderRadius: '8px' }}
                      itemStyle={{ color: '#c8e64e' }}
                      labelFormatter={formatRankDate}
                      formatter={formatRankTooltip}
                    />
                    <Line type="monotone" dataKey="rank" stroke="#c8e64e" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#c8e64e' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Recent Matches */}
          <section>
            <h2 className="text-lg font-bold mb-4">Recent Matches</h2>
            {mLoading ? <TableSkeleton /> : !matches || matches.length === 0 ? <div className="text-text-muted text-sm">No recent matches found.</div> : (
              <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-surface-elevated text-text-muted text-xs uppercase border-b border-surface-border">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Tournament</th>
                        <th className="px-4 py-3 font-medium">Opponent</th>
                        <th className="px-4 py-3 font-medium">Result</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {matches.map(match => {
                        const isWinner = match.winner?.id === playerId;
                        const opponent = match.player1.id === playerId ? match.player2 : match.player1;
                        return (
                          <tr key={match.id} className="hover:bg-surface-hover transition-colors">
                            <td className="px-4 py-3 text-text-secondary">{formatDate(match.matchDate)}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-text-primary">{match.tournament?.name}</div>
                              <div className="flex gap-2 items-center mt-1">
                                <SurfaceBadge surface={match.tournament?.surface} />
                                <span className="text-xs text-text-muted">{match.roundName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Link to={`/players/${opponent.id}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                                <PlayerAvatar name={opponent.name} imagePath={opponent.imagePath} size="sm" />
                                <span>{opponent.name}</span>
                                <CountryBadge countryCode={opponent.countryCode} flagSize="sm" showCode />
                              </Link>
                            </td>
                            <td className="px-4 py-3 font-bold">
                              {isWinner ? <span className="text-grass-light">W</span> : <span className="text-clay">L</span>}
                            </td>
                            <td className="px-4 py-3 font-mono">{match.score || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
