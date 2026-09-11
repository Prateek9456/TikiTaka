import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateTime, formatDurationMs, getSessionDurationMs } from '../../lib/sessionUtils';
import type { GameSession } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface MatchesPerSessionChartProps {
  sessions: GameSession[];
  loading: boolean;
  hasLinkedAccount: boolean;
}

interface SessionChartPoint {
  label: string;
  matchCount: number;
  duration: string;
  startedAt: string;
}

export function MatchesPerSessionChart({
  sessions,
  loading,
  hasLinkedAccount,
}: MatchesPerSessionChartProps) {
  const data: SessionChartPoint[] = [...sessions]
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .slice(-10)
    .map((session, index) => ({
      label: `S${index + 1}`,
      matchCount: session.matchCount,
      duration: formatDurationMs(getSessionDurationMs(session)),
      startedAt: formatDateTime(session.startedAt),
    }));

  return (
    <ChartCard
      title="Matches per Session"
      description="Number of matches in each recent play session"
      empty={!loading && hasLinkedAccount && data.length === 0}
      emptyMessage="Play matches to build session history"
    >
      {!hasLinkedAccount ? (
        <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface/50 px-6 text-center">
          <p className="text-sm text-slate-500">Link a game account to see matches per session</p>
        </div>
      ) : loading ? (
        <div className="flex h-full min-h-[280px] items-center justify-center">
          <p className="text-sm text-slate-500">Loading sessions…</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#2a3544' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#2a3544' }}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: 'rgba(52, 211, 153, 0.08)' }}
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #2a3544',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value: number) => [`${value} match${value === 1 ? '' : 'es'}`, 'Matches']}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as SessionChartPoint | undefined;
                return point ? `${point.startedAt} · ${point.duration}` : '';
              }}
            />
            <Bar dataKey="matchCount" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
