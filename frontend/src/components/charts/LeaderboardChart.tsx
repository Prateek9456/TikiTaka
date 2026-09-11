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
import type { LeaderboardEntry } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface LeaderboardChartProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardChart({ entries }: LeaderboardChartProps) {
  const data = [...entries]
    .sort((a, b) => a.rank - b.rank)
    .map((e) => ({
      name: e.currentUser ? `${e.username} (you)` : e.username,
      score: Number(Number(e.score).toFixed(1)),
      rank: e.rank,
      currentUser: Boolean(e.currentUser),
    }));

  return (
    <ChartCard
      title="Your Leaderboard"
      description="Top performers by TikiTaka score — your rank highlighted"
      empty={data.length === 0}
      emptyMessage="Leaderboard populates after you play and scoring runs"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#2a3544' }}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(167, 139, 250, 0.08)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <p className="font-medium text-white">#{item.rank} {item.name}</p>
                  <p className="mt-1 text-chart-violet">Score: {item.score}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="score" fill="#a78bfa" radius={[8, 8, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={`${entry.rank}-${entry.name}`} fill={entry.currentUser ? 'rgb(var(--accent))' : '#a78bfa'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
