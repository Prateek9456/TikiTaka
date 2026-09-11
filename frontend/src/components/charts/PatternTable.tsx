import type { TacticalPattern } from '../../types/api';

interface PatternTableProps {
  patterns: TacticalPattern[];
  selectedId: number | null;
  highlightedSlug?: string | null;
  onSelect: (pattern: TacticalPattern) => void;
}

function formatSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatPercent(rate: number): string {
  return `${(Number(rate) * 100).toFixed(1)}%`;
}

export function PatternTable({ patterns, selectedId, highlightedSlug, onSelect }: PatternTableProps) {
  if (patterns.length === 0) {
    return (
      <div className="esports-card p-8 text-center">
        <p className="text-sm text-slate-500">No tactical patterns detected for this game yet.</p>
      </div>
    );
  }

  return (
    <div className="esports-card overflow-hidden">
      <div className="border-b border-surface-border px-5 py-4">
        <h3 className="text-base font-semibold text-white">Tactical Patterns</h3>
        <p className="mt-1 text-sm text-slate-500">
          Click a row to inspect its event sequence visualization
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface/50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">Pattern</th>
              <th className="px-5 py-3 font-medium">Win Rate</th>
              <th className="px-5 py-3 font-medium">Samples</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Event Chain</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((pattern) => {
              const selected = pattern.id === selectedId;
              const highlighted = highlightedSlug === pattern.patternSlug;
              return (
                <tr
                  key={pattern.id}
                  onClick={() => onSelect(pattern)}
                  className={`cursor-pointer border-b border-surface-border/50 transition hover:bg-accent/5 ${
                    selected ? 'bg-accent/10' : ''
                  } ${highlighted ? 'ring-1 ring-inset ring-accent/50 bg-accent/5' : ''}`}
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{pattern.patternName || formatSlug(pattern.patternSlug)}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{pattern.patternSlug}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                        Number(pattern.winRate) >= 0.6
                          ? 'bg-accent/20 text-accent-glow'
                          : Number(pattern.winRate) >= 0.4
                            ? 'bg-chart-cyan/20 text-chart-cyan'
                            : 'bg-chart-amber/20 text-chart-amber'
                      }`}
                    >
                      {formatPercent(pattern.winRate)}
                    </span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-300">{pattern.sampleSize}</td>
                  <td className="hidden px-5 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {pattern.eventSequence?.slice(0, 4).map((event, i) => (
                        <span
                          key={`${pattern.id}-${i}`}
                          className="rounded bg-surface px-2 py-0.5 font-mono text-xs text-slate-400"
                        >
                          {event}
                        </span>
                      ))}
                      {(pattern.eventSequence?.length ?? 0) > 4 && (
                        <span className="text-xs text-slate-600">
                          +{pattern.eventSequence.length - 4}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
