import type { GameSession } from '../types/api';

export function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getSessionDurationMs(session: GameSession): number {
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endedAt).getTime();
  return Math.max(0, end - start);
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) {
    return '0m';
  }

  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0) {
    return 'just now';
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function overlapsToday(session: GameSession): boolean {
  const startOfToday = getStartOfToday().getTime();
  return new Date(session.endedAt).getTime() > startOfToday;
}

export function playTimeTodayMs(sessions: GameSession[]): number {
  const startOfToday = getStartOfToday().getTime();

  return sessions.reduce((sum, session) => {
    if (!overlapsToday(session)) {
      return sum;
    }

    const start = Math.max(new Date(session.startedAt).getTime(), startOfToday);
    const end = new Date(session.endedAt).getTime();
    return sum + Math.max(0, end - start);
  }, 0);
}

export function sessionsToday(sessions: GameSession[]): GameSession[] {
  return sessions.filter(overlapsToday);
}

export function totalMatchesToday(sessions: GameSession[]): number {
  return sessionsToday(sessions).reduce((sum, session) => sum + session.matchCount, 0);
}
