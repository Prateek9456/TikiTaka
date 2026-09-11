import { Calendar } from 'lucide-react';
import {
  formatDateTime,
  formatDurationMs,
  formatTime,
  getSessionDurationMs,
} from '../../lib/sessionUtils';
import type { GameSession } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface GameSessionTimelineProps {
  sessions: GameSession[];
  loading: boolean;
  hasLinkedAccount: boolean;
}

export function GameSessionTimeline({
  sessions,
  loading,
  hasLinkedAccount,
}: GameSessionTimelineProps) {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  const maxDurationMs = sortedSessions.reduce(
    (max, session) => Math.max(max, getSessionDurationMs(session)),
    0,
  );

  return (
    <ChartCard
      title="Session Timeline"
      description="Play sessions inferred from match timestamps (last 7 days)"
      empty={!loading && hasLinkedAccount && sortedSessions.length === 0}
      emptyMessage="No play sessions yet — matches are grouped into sessions automatically"
    >
      {!hasLinkedAccount ? (
        <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface/50 px-6 text-center">
          <p className="text-sm text-slate-500">Link a game account to see your session history</p>
        </div>
      ) : loading ? (
        <div className="flex h-full min-h-[280px] items-center justify-center">
          <p className="text-sm text-slate-500">Loading sessions…</p>
        </div>
      ) : (
        <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
          {sortedSessions.map((session) => {
            const durationMs = getSessionDurationMs(session);
            const widthPercent =
              maxDurationMs > 0 ? Math.max(12, (durationMs / maxDurationMs) * 100) : 12;

            return (
              <div
                key={session.id}
                className="rounded-lg border border-surface-border bg-surface/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span>
                        {formatTime(session.startedAt)} – {formatTime(session.endedAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(session.startedAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-white">
                      {formatDurationMs(durationMs)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {session.matchCount} match{session.matchCount === 1 ? '' : 'es'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent-glow"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
