import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '../../types/api';
import { EsportsCard } from '../ui/EsportsCard';

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardPanel({ entries }: LeaderboardPanelProps) {
  const rows = [...entries].sort((a, b) => a.rank - b.rank).slice(0, 8);

  return (
    <EsportsCard className="h-full p-5" delay={0.1}>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="label-kicker">Performances</p>
          <h3 className="mt-1 font-display text-lg font-bold text-white">Live ladder</h3>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">Ladder fills after scoring runs on your matches.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((entry, index) => (
            <motion.div
              key={`${entry.playerId}-${entry.rank}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * index }}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                entry.currentUser
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-transparent bg-surface/40'
              }`}
            >
              <span className="w-6 font-display text-sm font-bold text-ink-faint">#{entry.rank}</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated font-display text-xs font-bold text-white">
                {entry.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {entry.username}
                  {entry.currentUser ? ' · you' : ''}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-ink-faint">{entry.metric}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-chart-cyan/40 bg-chart-cyan/10 font-display text-xs font-bold text-chart-cyan shadow-[0_0_16px_rgba(34,211,238,0.35)]">
                {Number(entry.score).toFixed(1)}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </EsportsCard>
  );
}
