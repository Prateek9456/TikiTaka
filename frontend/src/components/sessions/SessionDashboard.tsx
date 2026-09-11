import { History } from 'lucide-react';
import { useAuthSessions, useGameSessions, useGameSessionsHeatmap } from '../../hooks/useSessionData';
import { ActivityHeatmap } from '../dashboard/ActivityHeatmap';
import { AuthSessionHistory } from './AuthSessionHistory';
import { GameSessionTimeline } from './GameSessionTimeline';
import { MatchesPerSessionChart } from './MatchesPerSessionChart';
import { PlayTimeToday } from './PlayTimeToday';

interface SessionDashboardProps {
  gameId: number | null;
  hasLinkedAccount: boolean;
}

export function SessionDashboard({ gameId, hasLinkedAccount }: SessionDashboardProps) {
  const {
    data: gameSessions,
    loading: gameSessionsLoading,
    error: gameSessionsError,
  } = useGameSessions(gameId, hasLinkedAccount);
  const {
    data: heatmapSessions,
    loading: heatmapLoading,
  } = useGameSessionsHeatmap(gameId, hasLinkedAccount);
  const {
    data: authSessions,
    loading: authSessionsLoading,
    error: authSessionsError,
  } = useAuthSessions();

  return (
    <div className="space-y-6">
      <ActivityHeatmap
        sessions={heatmapSessions}
        loading={heatmapLoading}
        hasLinkedAccount={hasLinkedAccount}
      />

      {gameSessionsError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Failed to load game sessions: {gameSessionsError}
        </div>
      ) : null}

      <div>
        <PlayTimeToday
          sessions={gameSessions}
          loading={gameSessionsLoading}
          hasLinkedAccount={hasLinkedAccount}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GameSessionTimeline
          sessions={gameSessions}
          loading={gameSessionsLoading}
          hasLinkedAccount={hasLinkedAccount}
        />
        <MatchesPerSessionChart
          sessions={gameSessions}
          loading={gameSessionsLoading}
          hasLinkedAccount={hasLinkedAccount}
        />
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-accent-glow" />
          <h3 className="text-sm font-semibold text-white">Sign-in History</h3>
        </div>
        <AuthSessionHistory
          sessions={authSessions}
          loading={authSessionsLoading}
          error={authSessionsError}
        />
      </div>
    </div>
  );
}
