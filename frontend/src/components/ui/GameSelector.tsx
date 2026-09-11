import { LayoutGroup, motion } from 'framer-motion';
import type { Game } from '../../types/api';
import { GameLogo } from '../brand/GameLogo';
import { getGameTheme } from '../../lib/gameTheme';

interface GameSelectorProps {
  games: Game[];
  selectedId: number | null;
  onChange: (gameId: number) => void;
  loading?: boolean;
}

export function GameSelector({ games, selectedId, onChange, loading }: GameSelectorProps) {
  return (
    <LayoutGroup>
      <div className="flex items-center gap-1 rounded-full border border-surface-border bg-surface-raised/80 p-1">
      {games.length === 0 ? (
        <span className="px-3 py-1 text-xs text-ink-faint">{loading ? 'Syncing titles…' : 'No games'}</span>
      ) : (
        games.map((game) => {
          const active = game.id === selectedId;
          const theme = getGameTheme(game.slug);
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => onChange(game.id)}
              className={`relative flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wider transition ${
                active ? 'text-surface' : 'text-slate-400 hover:text-white'
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="game-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="relative z-10 flex items-center gap-1.5">
                <GameLogo slug={game.slug} size={18} />
                <span className="hidden sm:inline">{theme.shortLabel}</span>
              </span>
            </button>
          );
        })
      )}
    </div>
    </LayoutGroup>
  );
}
