import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TacticalPattern } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface EventSequenceChartProps {
  pattern: TacticalPattern | null;
}

export function EventSequenceChart({ pattern }: EventSequenceChartProps) {
  const events = pattern?.eventSequence ?? [];

  const data = events.map((event, index) => ({
    step: index + 1,
    event: event.replace(/_/g, ' '),
    intensity: events.length - index,
  }));

  return (
    <ChartCard
      title="Event Sequence Flow"
      description={
        pattern
          ? `${pattern.patternName} — tactical state transitions`
          : 'Select a pattern below to visualize its event chain'
      }
      empty={!pattern || events.length === 0}
      emptyMessage="Click a pattern row to view its Markov event sequence"
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
          <defs>
            <linearGradient id="sequenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
          <XAxis
            dataKey="event"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#2a3544' }}
            tickLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={70}
          />
          <YAxis
            hide
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <p className="font-medium text-white">Step {item.step}</p>
                  <p className="mt-1 capitalize text-accent-glow">{item.event}</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="intensity"
            stroke="rgb(var(--accent-glow))"
            strokeWidth={3}
            fill="url(#sequenceGradient)"
            dot={{ fill: 'rgb(var(--accent-glow))', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 7, fill: 'rgb(var(--accent))' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
