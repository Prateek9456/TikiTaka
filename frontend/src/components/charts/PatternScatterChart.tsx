import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { TacticalPattern } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface PatternScatterChartProps {
  patterns: TacticalPattern[];
}

function formatSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function PatternScatterChart({ patterns }: PatternScatterChartProps) {
  const data = patterns.map((p) => ({
    name: formatSlug(p.patternSlug),
    winRate: Number((Number(p.winRate) * 100).toFixed(1)),
    sampleSize: p.sampleSize,
    slug: p.patternSlug,
  }));

  return (
    <ChartCard
      title="Effectiveness vs Volume"
      description="Win rate plotted against sample size — bubble size reflects confidence"
      empty={data.length === 0}
      emptyMessage="Pattern scatter plot will populate after match analysis"
    >
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
          <XAxis
            type="number"
            dataKey="sampleSize"
            name="Samples"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#2a3544' }}
            tickLine={false}
            label={{ value: 'Sample Size', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="winRate"
            name="Win Rate"
            unit="%"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#2a3544' }}
            tickLine={false}
            label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
          />
          <ZAxis type="number" dataKey="sampleSize" range={[80, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'rgb(var(--accent))' }}
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
          <Scatter name="Patterns" data={data} fill="rgb(var(--accent-glow))" fillOpacity={0.85} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
