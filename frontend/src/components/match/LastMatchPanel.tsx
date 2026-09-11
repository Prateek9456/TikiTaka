import { Clock, RefreshCw, Swords, Zap } from 'lucide-react';
import type { MatchAnalysis } from '../../types/api';

interface LastMatchPanelProps {
  match: MatchAnalysis | null;
  loading: boolean;
  error: string | null;
  analyzing?: boolean;
  polling?: boolean;
  hasLinkedAccount?: boolean;
  onRefresh: () => void;
  onPatternSlugClick?: (slug: string) => void;
}

function formatSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatRelativeTime(playedAt: string): string {
  const played = new Date(playedAt);
  const diffMs = Date.now() - played.getTime();

  if (diffMs < 0) {
    return 'just now';
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return played.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: played.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return '—';
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatMatchTimestamp(timestampMs: number): string {
  const totalSeconds = Math.floor(timestampMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.8) {
    return 'bg-accent/20 text-accent-glow';
  }
  if (confidence >= 0.6) {
    return 'bg-chart-cyan/20 text-chart-cyan';
  }
  return 'bg-chart-amber/20 text-chart-amber';
}

export function LastMatchPanel({
  match,
  loading,
  error,
  analyzing = false,
  polling = false,
  hasLinkedAccount = true,
  onRefresh,
  onPatternSlugClick,
}: LastMatchPanelProps) {
  const isRefreshing = loading && match !== null;

  return (
    <div className="esports-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-surface-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-accent-glow" />
            <h3 className="text-base font-semibold text-white">Your Last Match</h3>
            {polling ? (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-glow">
                Live
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {hasLinkedAccount
              ? 'Your most recent match and detected tactical patterns'
              : 'Link a game account to see your personal match analysis'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-surface-border bg-surface/80 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-accent/40 hover:bg-accent/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="p-5">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Failed to load match analysis: {error}
          </div>
        )}

        {!error && loading && !match && hasLinkedAccount && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface/50 px-6 text-center">
            <RefreshCw className="mb-3 h-8 w-8 animate-spin text-accent-glow" />
            <p className="text-sm font-medium text-slate-300">Looking for your latest match…</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              We check every 10 seconds for up to 3 minutes after you open the dashboard.
            </p>
          </div>
        )}

        {!error && !loading && !match && hasLinkedAccount && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface/50 px-6 text-center">
            <Zap className="mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">No matches found yet</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Play a match and we will ingest it automatically within a few minutes.
            </p>
          </div>
        )}

        {!error && !hasLinkedAccount && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface/50 px-6 text-center">
            <Zap className="mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">No game account linked</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Connect your gaming account above to start tracking your personal matches.
            </p>
          </div>
        )}

        {match && analyzing && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-glow">
            Analyzing your last match… tactical patterns usually appear within 30–60 seconds.
          </div>
        )}

        {match && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatItem label="Match ID" value={String(match.matchId)} mono />
              <StatItem
                label="Played"
                value={formatRelativeTime(match.playedAt)}
                subtext={new Date(match.playedAt).toLocaleString()}
              />
              <StatItem label="Duration" value={formatDuration(match.durationSeconds)} />
              <StatItem label="Events" value={match.eventCount.toLocaleString()} />
              <StatItem label="Patterns" value={String(match.patternOccurrenceCount)} />
            </div>

            {match.externalMatchId && (
              <p className="font-mono text-xs text-slate-500">
                External ID: {match.externalMatchId}
              </p>
            )}

            {match.patterns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-surface-border bg-surface/50 px-4 py-6 text-center text-sm text-slate-500">
                No tactical patterns detected in this match yet.
              </div>
            ) : (
              <div>
                <h4 className="mb-3 text-sm font-medium text-slate-300">Detected Patterns</h4>
                <div className="overflow-x-auto rounded-lg border border-surface-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-surface-border bg-surface/50 text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3 font-medium">Pattern</th>
                        <th className="px-4 py-3 font-medium">Confidence</th>
                        <th className="px-4 py-3 font-medium">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.patterns.map((occurrence) => (
                        <tr
                          key={`${occurrence.patternSlug}-${occurrence.timestampMs}`}
                          className="border-b border-surface-border/50 last:border-0"
                        >
                          <td className="px-4 py-3">
                            {onPatternSlugClick ? (
                              <button
                                type="button"
                                onClick={() => onPatternSlugClick(occurrence.patternSlug)}
                                className="group text-left"
                              >
                                <p className="font-medium text-white group-hover:text-accent-glow">
                                  {formatSlug(occurrence.patternSlug)}
                                </p>
                                <p className="mt-0.5 font-mono text-xs text-slate-500 group-hover:text-accent/80">
                                  {occurrence.patternSlug}
                                </p>
                              </button>
                            ) : (
                              <>
                                <p className="font-medium text-white">
                                  {formatSlug(occurrence.patternSlug)}
                                </p>
                                <p className="mt-0.5 font-mono text-xs text-slate-500">
                                  {occurrence.patternSlug}
                                </p>
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${confidenceBadgeClass(
                                occurrence.confidence,
                              )}`}
                            >
                              {(occurrence.confidence * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-300">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              {formatMatchTimestamp(occurrence.timestampMs)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  subtext,
  mono,
}: {
  label: string;
  value: string;
  subtext?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold text-white ${mono ? 'font-mono text-base' : ''}`}
      >
        {value}
      </p>
      {subtext && <p className="mt-0.5 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
}
