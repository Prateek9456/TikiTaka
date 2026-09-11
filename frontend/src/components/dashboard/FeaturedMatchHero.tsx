import { motion } from 'framer-motion';
import { Clock, RefreshCw, Swords } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Game, MatchAnalysis } from '../../types/api';
import { GameLogo } from '../brand/GameLogo';
import { LiveBadge } from '../ui/LiveBadge';
import { EsportsCard } from '../ui/EsportsCard';

interface FeaturedMatchHeroProps {
  game?: Game;
  match: MatchAnalysis | null;
  loading: boolean;
  polling: boolean;
  analyzing: boolean;
  hasLinkedAccount: boolean;
  onRefresh: () => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return '--:--';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function FeaturedMatchHero({
  game,
  match,
  loading,
  polling,
  analyzing,
  hasLinkedAccount,
  onRefresh,
}: FeaturedMatchHeroProps) {
  const eventShare = match && match.eventCount > 0
    ? Math.min(100, Math.round((match.patternOccurrenceCount / Math.max(match.eventCount, 1)) * 100))
    : 42;
  const leftover = 100 - eventShare;

  return (
    <EsportsCard className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-kicker">Headline match</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-wide text-white sm:text-3xl">
            {game?.name ?? 'TikiTaka'}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {hasLinkedAccount ? 'Your most recent competitive sample' : 'Link an account to personalize this stage'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {polling || analyzing ? <LiveBadge /> : null}
          <button type="button" onClick={onRefresh} className="btn-ghost !px-3 !py-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-4">
          <motion.div animate={{ rotate: [0, 4, 0] }} transition={{ duration: 6, repeat: Infinity }}>
            <GameLogo slug={game?.slug} size={84} />
          </motion.div>
          <div>
            <p className="font-display text-lg font-bold text-white">You</p>
            <p className="text-sm text-ink-muted">{match ? `${match.eventCount} events` : 'Waiting for feed'}</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-ink-faint">Duration</p>
          <p className="mt-1 font-display text-5xl font-black tabular-nums text-white">
            {loading && !match ? '...' : formatDuration(match?.durationSeconds ?? null)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5" />
            {match ? new Date(match.playedAt).toLocaleString() : 'No match clock yet'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-4">
          <div className="text-right">
            <p className="font-display text-lg font-bold text-white">Patterns</p>
            <p className="text-sm text-ink-muted">
              {match ? `${match.patternOccurrenceCount} detections` : 'Markov idle'}
            </p>
          </div>
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
            <Swords className="h-8 w-8 text-accent" />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
          <span>Event share {eventShare}%</span>
          <span>Residual {leftover}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-elevated">
          <motion.div
            className="bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${eventShare}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="flex-1 bg-white/10" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/dashboard/match" className="btn-ghost">
          Match details
        </Link>
        <Link to="/dashboard/analysis" className="btn-primary">
          Open analysis
        </Link>
      </div>
    </EsportsCard>
  );
}
