import { useState, useEffect } from 'react';
import { comparePlayers } from '../api/players';
import { PlayerSearch } from '../features/PlayerSearch';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CountryFlag } from '../components/CountryFlag';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { formatStat, formatWL } from '../utils/format';
import { Users, Activity } from 'lucide-react';
import { PlayerComparisonDto } from '../types';

export function ComparePage() {
  const [p1Id, setP1Id] = useState<number | null>(null);
  const [p2Id, setP2Id] = useState<number | null>(null);
  const [data, setData] = useState<PlayerComparisonDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (p1Id && p2Id) {
      setLoading(true);
      setError(null);
      comparePlayers(p1Id, p2Id)
        .then(setData)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [p1Id, p2Id]);

  const CompRow = ({ label, val1, val2, higherIsBetter = true, format = (v: any) => v ?? '—' }: any) => {
    let w1 = false, w2 = false;
    if (val1 != null && val2 != null) {
      if (val1 > val2) { w1 = higherIsBetter; w2 = !higherIsBetter; }
      else if (val2 > val1) { w2 = higherIsBetter; w1 = !higherIsBetter; }
    }
    return (
      <div className="grid grid-cols-3 py-3 border-b border-surface-border items-center text-sm">
        <div className={`text-center font-mono ${w1 ? 'text-accent font-bold' : 'text-text-primary'}`}>{format(val1)}</div>
        <div className="text-center text-text-muted text-xs uppercase tracking-wider">{label}</div>
        <div className={`text-center font-mono ${w2 ? 'text-accent font-bold' : 'text-text-primary'}`}>{format(val2)}</div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-text-primary flex items-center justify-center gap-3">
          <Users className="text-accent" /> Player Comparison
        </h1>
        <p className="text-text-secondary">Select two players to compare their career and season statistics side-by-side.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface-elevated p-6 rounded-card border border-surface-border">
        <PlayerSearch label="Player 1" value={p1Id} onChange={setP1Id} disabledId={p2Id} />
        <PlayerSearch label="Player 2" value={p2Id} onChange={setP2Id} disabledId={p1Id} />
      </div>

      {loading ? (
        <div className="bg-surface-card rounded-card p-8 border border-surface-border space-y-6">
          <div className="flex justify-between"><Skeleton width="100px" height="100px" /><Skeleton width="100px" height="100px" /></div>
          {Array.from({length: 8}).map((_, i) => <Skeleton key={i} height="40px" />)}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <EmptyState title="Ready to Compare" message="Select two players above to view their head-to-head metrics." />
      ) : (
        <div className="bg-surface-card rounded-card border border-surface-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 p-6 bg-surface-elevated border-b border-surface-border items-center">
            <div className="flex flex-col items-center text-center gap-3">
              <PlayerAvatar name={data.player1.name} imagePath={data.player1.imagePath} size="lg" />
              <div>
                <h3 className="text-lg font-bold">{data.player1.name}</h3>
                <CountryFlag countryCode={data.player1.countryCode} />
              </div>
            </div>
            <div className="text-center text-text-muted text-xs uppercase tracking-widest font-bold">VS</div>
            <div className="flex flex-col items-center text-center gap-3">
              <PlayerAvatar name={data.player2.name} imagePath={data.player2.imagePath} size="lg" />
              <div>
                <h3 className="text-lg font-bold">{data.player2.name}</h3>
                <CountryFlag countryCode={data.player2.countryCode} />
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-6">
            <h4 className="text-center text-sm font-bold text-text-secondary uppercase tracking-widest mb-4 bg-surface-hover py-2 rounded-badge">General Profile</h4>
            <CompRow label="Current Rank" val1={data.player1.currentRank} val2={data.player2.currentRank} higherIsBetter={false} />
            <CompRow label="Points" val1={data.player1.currentPoints} val2={data.player2.currentPoints} format={(v:any) => v?.toLocaleString()} />
            <CompRow label="Age" val1={data.player1.age} val2={data.player2.age} higherIsBetter={false} />
            <CompRow label="Height (cm)" val1={data.player1.heightCm} val2={data.player2.heightCm} />
            <CompRow label="Career High Rank" val1={data.player1.careerHighRank} val2={data.player2.careerHighRank} higherIsBetter={false} />
            <CompRow label="Career Titles" val1={data.player1.careerStats?.careerTitles} val2={data.player2.careerStats?.careerTitles} />
            <CompRow label="Career Win %" val1={data.player1.careerStats?.careerWinPct} val2={data.player2.careerStats?.careerWinPct} format={(v:any) => v ? `${v.toFixed(1)}%` : '—'} />

            <h4 className="text-center text-sm font-bold text-text-secondary uppercase tracking-widest mt-8 mb-4 bg-surface-hover py-2 rounded-badge flex items-center justify-center gap-2">
              <Activity size={16} className="text-accent" /> 2026 Season Performance
            </h4>
            
            <CompRow label="Matches Played" val1={data.player1SeasonStats?.matches} val2={data.player2SeasonStats?.matches} />
            <CompRow label="Win %" val1={data.player1SeasonStats?.winPct} val2={data.player2SeasonStats?.winPct} format={(v:any) => v ? `${v.toFixed(1)}%` : '—'} />
            
            <div className="grid grid-cols-3 py-3 border-b border-surface-border items-center text-sm">
              <div className="text-center font-mono">{formatWL(data.player1SeasonStats?.wins, data.player1SeasonStats?.losses)}</div>
              <div className="text-center text-text-muted text-xs uppercase tracking-wider">W-L Record</div>
              <div className="text-center font-mono">{formatWL(data.player2SeasonStats?.wins, data.player2SeasonStats?.losses)}</div>
            </div>

            <CompRow label="Aces" val1={data.player1SeasonStats?.serve.aces} val2={data.player2SeasonStats?.serve.aces} />
            <CompRow label="1st Serve Pts Won" val1={data.player1SeasonStats?.serve.firstServePointsWonPct} val2={data.player2SeasonStats?.serve.firstServePointsWonPct} format={(v:any) => formatStat(v, 1, '%')} />
            <CompRow label="Break Pts Saved" val1={data.player1SeasonStats?.serve.breakPointsSavedPct} val2={data.player2SeasonStats?.serve.breakPointsSavedPct} format={(v:any) => formatStat(v, 1, '%')} />
            <CompRow label="Break Pts Converted" val1={data.player1SeasonStats?.serve.breakPointsConvertedPct} val2={data.player2SeasonStats?.serve.breakPointsConvertedPct} format={(v:any) => formatStat(v, 1, '%')} />
          </div>
        </div>
      )}
    </div>
  );
}
