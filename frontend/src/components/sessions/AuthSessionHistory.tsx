import { LogIn, Shield } from 'lucide-react';
import { PROVIDER_LABELS } from '../../lib/oauth';
import { formatDateTime, formatRelativeTime } from '../../lib/sessionUtils';
import type { AuthSession } from '../../types/api';
import { ChartCard } from '../ui/ChartCard';

interface AuthSessionHistoryProps {
  sessions: AuthSession[];
  loading: boolean;
  error: string | null;
}

export function AuthSessionHistory({ sessions, loading, error }: AuthSessionHistoryProps) {
  const recentSessions = sessions.slice(0, 8);

  return (
    <ChartCard
      title="Login History"
      description="Recent sign-ins across linked providers"
      empty={!loading && !error && recentSessions.length === 0}
      emptyMessage="Your login history will appear here after you sign in"
    >
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Failed to load login history: {error}
        </div>
      ) : loading ? (
        <div className="flex h-full min-h-[200px] items-center justify-center">
          <p className="text-sm text-slate-500">Loading login history…</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentSessions.map((session) => {
            const isActive = session.logoutAt === null;

            return (
              <div
                key={session.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface/40 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-glow">
                    <LogIn className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {session.provider ? PROVIDER_LABELS[session.provider] : 'Email'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {formatDateTime(session.loginAt)}
                      {session.location ? ` · ${session.location}` : session.ipAddress ? ` · ${session.ipAddress}` : ''}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      isActive
                        ? 'bg-accent/20 text-accent-glow'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <Shield className="h-3 w-3" />
                        Active
                      </>
                    ) : (
                      formatRelativeTime(session.logoutAt!)
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
