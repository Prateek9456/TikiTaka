import { Clock, Gamepad2, Swords } from 'lucide-react';
import { useMemo } from 'react';
import {
  playTimeTodayMs,
  sessionsToday,
  totalMatchesToday,
  formatDurationMs,
} from '../../lib/sessionUtils';
import type { GameSession } from '../../types/api';
import { StatCard } from '../ui/StatCard';

interface PlayTimeTodayProps {
  sessions: GameSession[];
  loading: boolean;
  hasLinkedAccount: boolean;
}

export function PlayTimeToday({ sessions, loading, hasLinkedAccount }: PlayTimeTodayProps) {
  const stats = useMemo(() => {
    const todaySessions = sessionsToday(sessions);
    return {
      playTimeMs: playTimeTodayMs(sessions),
      sessionCount: todaySessions.length,
      matchCount: totalMatchesToday(sessions),
    };
  }, [sessions]);

  if (!hasLinkedAccount) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Play Time Today"
          value="—"
          subtext="Link a game account to track sessions"
          icon={<Clock className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="Sessions Today"
          value="—"
          subtext="Inferred from match polling"
          icon={<Gamepad2 className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Matches Today"
          value="—"
          subtext="Per play session"
          icon={<Swords className="h-5 w-5" />}
          accent="emerald"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Play Time Today"
        value={loading ? '…' : formatDurationMs(stats.playTimeMs)}
        subtext={stats.playTimeMs > 0 ? 'Across all sessions today' : 'No play time recorded yet'}
        icon={<Clock className="h-5 w-5" />}
        accent="cyan"
      />
      <StatCard
        label="Sessions Today"
        value={loading ? '…' : String(stats.sessionCount)}
        subtext={
          stats.sessionCount === 1
            ? '1 inferred session'
            : `${stats.sessionCount} inferred sessions`
        }
        icon={<Gamepad2 className="h-5 w-5" />}
        accent="violet"
      />
      <StatCard
        label="Matches Today"
        value={loading ? '…' : String(stats.matchCount)}
        subtext={
          stats.matchCount === 1 ? '1 match played today' : `${stats.matchCount} matches played today`
        }
        icon={<Swords className="h-5 w-5" />}
        accent="emerald"
      />
    </div>
  );
}
