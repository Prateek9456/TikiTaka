import type { GameSession } from '../types/api';
import { getSessionDurationMs } from './sessionUtils';

export interface HeatmapDay {
  date: string;
  playTimeMs: number;
  matchCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const WEEKS = 52;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getIntensityLevel(playTimeMs: number): HeatmapDay['level'] {
  if (playTimeMs <= 0) return 0;
  const hours = playTimeMs / 3_600_000;
  if (hours < 0.5) return 1;
  if (hours < 2) return 2;
  if (hours < 4) return 3;
  return 4;
}

export function buildActivityHeatmap(sessions: GameSession[], weeks = WEEKS): HeatmapDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = weeks * 7;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - totalDays + 1);

  const dayMap = new Map<string, { playTimeMs: number; matchCount: number }>();

  for (const session of sessions) {
    const key = toDateKey(new Date(session.startedAt));
    const existing = dayMap.get(key) ?? { playTimeMs: 0, matchCount: 0 };
    existing.playTimeMs += getSessionDurationMs(session);
    existing.matchCount += session.matchCount;
    dayMap.set(key, existing);
  }

  const days: HeatmapDay[] = [];
  const cursor = new Date(startDate);

  while (cursor <= today) {
    const key = toDateKey(cursor);
    const data = dayMap.get(key) ?? { playTimeMs: 0, matchCount: 0 };
    days.push({
      date: key,
      playTimeMs: data.playTimeMs,
      matchCount: data.matchCount,
      level: getIntensityLevel(data.playTimeMs),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function formatHeatmapDuration(ms: number): string {
  if (ms <= 0) return 'No play time';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m played` : `${hours}h played`;
  return `${minutes}m played`;
}

export const HEATMAP_LEVEL_COLORS: Record<HeatmapDay['level'], string> = {
  0: 'bg-surface-border/40',
  1: 'bg-accent/20',
  2: 'bg-accent/40',
  3: 'bg-accent/65',
  4: 'bg-accent-glow shadow-glow-sm',
};
