import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TacticalPattern } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface PatternWinRateChartProps {
  patterns: TacticalPattern[];
}

function formatSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function winRateColor(rate: number): string {
  if (rate >= 0.7) return 'rgb(var(--accent-glow))';
  if (rate >= 0.5) return '#22d3ee';
  if (rate >= 0.35) return '#fbbf24';
  return '#fb7185';
}

export function PatternWinRateChart({ patterns }: PatternWinRateChartProps) {
  const data = [...patterns]
    .sort((a, b) => Number(b.winRate) - Number(a.winRate))
    .slice(0, 10)
    .map((p) => ({
      name: formatSlug(p.patternSlug),
      winRate: Number((Number(p.winRate) * 100).toFixed(1)),
      sampleSize: p.sampleSize,
      slug: p.patternSlug,
    }));

  return (
    <ChartCard
      title="Pattern Win Rates"
      description="Top tactical patterns ranked by success rate"
      empty={data.length === 0}
      emptyMessage="Ingest matches to detect tactical patterns"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#2a3544' }}
            tickLine={false}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: '#cbd5e1', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgb(var(--accent) / 0.08)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="mt-1 text-accent-glow">Win rate: {item.winRate}%</p>
                  <p className="text-slate-400">Samples: {item.sampleSize}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="winRate" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry) => (
              <Cell key={entry.slug} fill={winRateColor(entry.winRate / 100)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
