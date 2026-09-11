import type { ReactNode } from 'react';
import { EsportsCard } from './EsportsCard';

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
}

export function ChartCard({
  title,
  description,
  children,
  action,
  empty,
  emptyMessage = 'No data available yet',
}: ChartCardProps) {
  return (
    <EsportsCard className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="label-kicker">Telemetry</p>
          <h3 className="mt-1 font-display text-base font-bold text-white">{title}</h3>
          {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="min-h-[280px] flex-1">
        {empty ? (
          <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-surface-border bg-surface/50">
            <p className="text-sm text-ink-muted">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </EsportsCard>
  );
}
