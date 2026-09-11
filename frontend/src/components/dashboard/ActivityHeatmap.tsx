import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  buildActivityHeatmap,
  formatHeatmapDuration,
  HEATMAP_LEVEL_COLORS,
  type HeatmapDay,
} from '../../lib/activityHeatmap';
import type { GameSession } from '../../types/api';

interface ActivityHeatmapProps {
  sessions: GameSession[];
  loading: boolean;
  hasLinkedAccount: boolean;
}

function groupIntoWeeks(days: HeatmapDay[]): HeatmapDay[][] {
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function ActivityHeatmap({ sessions, loading, hasLinkedAccount }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null);

  const days = useMemo(() => buildActivityHeatmap(sessions), [sessions]);
  const weeks = useMemo(() => groupIntoWeeks(days), [days]);

  const totalPlayTime = useMemo(
    () => days.reduce((sum, day) => sum + day.playTimeMs, 0),
    [days],
  );
  const activeDays = useMemo(() => days.filter((day) => day.level > 0).length, [days]);

  if (!hasLinkedAccount) {
    return (
      <div className="card-glow p-6">
        <h3 className="font-display text-lg font-semibold text-white">Play Activity</h3>
        <p className="mt-1 text-sm text-slate-500">Link a game account to track your play streak</p>
        <div className="mt-6 flex gap-1 opacity-30">
          {Array.from({ length: 52 }).map((_, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {Array.from({ length: 7 }).map((__, dayIndex) => (
                <div key={dayIndex} className="h-3 w-3 rounded-sm bg-surface-border/40" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-glow p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">Play Activity</h3>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? 'Loading play history…'
              : `${activeDays} active days in the last year`}
          </p>
        </div>
        {!loading && totalPlayTime > 0 ? (
          <p className="text-sm font-medium text-accent-glow">
            {formatHeatmapDuration(totalPlayTime)} total
          </p>
        ) : null}
      </div>

      <div className="relative overflow-x-auto pb-2">
        <div className="inline-flex gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: weekIndex * 0.008 + (week.indexOf(day) % 7) * 0.004,
                    duration: 0.2,
                  }}
                  onMouseEnter={(event) => {
                    const rect = (event.target as HTMLElement).getBoundingClientRect();
                    setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  className={`h-[13px] w-[13px] cursor-pointer rounded-sm transition-all duration-150 hover:ring-1 hover:ring-accent/50 ${HEATMAP_LEVEL_COLORS[day.level]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <div key={level} className={`h-3 w-3 rounded-sm ${HEATMAP_LEVEL_COLORS[level]}`} />
        ))}
        <span>More</span>
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <p className="font-medium text-white">
            {new Date(tooltip.day.date + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <p className="mt-0.5 text-slate-400">{formatHeatmapDuration(tooltip.day.playTimeMs)}</p>
          {tooltip.day.matchCount > 0 ? (
            <p className="text-slate-500">
              {tooltip.day.matchCount} match{tooltip.day.matchCount === 1 ? '' : 'es'}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
