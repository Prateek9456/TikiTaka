import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TacticalPattern } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface PatternDistributionChartProps {
  patterns: TacticalPattern[];
}

const COLORS = ['rgb(var(--accent))', '#22d3ee', '#a78bfa', '#fbbf24', '#fb7185', '#38bdf8', '#c084fc', '#ff8a4c'];

function formatSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function PatternDistributionChart({ patterns }: PatternDistributionChartProps) {
  const data = patterns
    .filter((p) => p.sampleSize > 0)
    .map((p) => ({
      name: formatSlug(p.patternSlug),
      value: p.sampleSize,
      slug: p.patternSlug,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <ChartCard
      title="Pattern Frequency"
      description="Distribution of detected pattern occurrences"
      empty={data.length === 0}
      emptyMessage="Pattern distribution appears after detections"
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={entry.slug} fill={COLORS[index % COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="mt-1 text-slate-400">Occurrences: {item.value}</p>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={48}
            formatter={(value: string) => <span className="text-xs text-slate-400">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
