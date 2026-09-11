import type { ReactNode } from 'react';
import { CountUp } from './CountUp';
import { EsportsCard } from './EsportsCard';

interface StatCardProps {
  label: string;
  value: string;
  numericValue?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  subtext?: string;
  icon?: ReactNode;
  accent?: 'emerald' | 'cyan' | 'violet' | 'amber';
  delay?: number;
}

const accentClasses = {
  emerald: 'text-accent-glow bg-accent/10',
  cyan: 'text-chart-cyan bg-chart-cyan/10',
  violet: 'text-chart-violet bg-chart-violet/10',
  amber: 'text-chart-amber bg-chart-amber/10',
};

export function StatCard({
  label,
  value,
  numericValue,
  decimals = 0,
  suffix = '',
  prefix = '',
  subtext,
  icon,
  accent = 'emerald',
  delay = 0,
}: StatCardProps) {
  return (
    <EsportsCard className="p-5" delay={delay}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-kicker">{label}</p>
          <p className="mt-3 truncate font-display text-3xl font-black tabular-nums text-white">
            {typeof numericValue === 'number' ? (
              <CountUp value={numericValue} decimals={decimals} suffix={suffix} prefix={prefix} />
            ) : (
              value
            )}
          </p>
          {subtext ? <p className="mt-1 text-sm text-ink-muted">{subtext}</p> : null}
        </div>
        {icon ? (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClasses[accent]}`}>
            {icon}
          </div>
        ) : null}
      </div>
    </EsportsCard>
  );
}
