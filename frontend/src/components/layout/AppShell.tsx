import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bell,
  Home,
  Layers,
  LogOut,
  Search,
  Settings,
  Swords,
  Target,
  Trophy,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent, ReactNode } from 'react';
import { TikiTakaLogo } from '../brand/TikiTakaLogo';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { getGameTheme } from '../../lib/gameTheme';
import { AnimatedBackground } from '../ui/AnimatedBackground';
import { GameSelector } from '../ui/GameSelector';
import { LiveClock } from '../ui/LiveClock';

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home, label: 'Home', end: true },
  { to: '/dashboard/match', icon: Swords, label: 'Match' },
  { to: '/dashboard/activity', icon: Activity, label: 'Activity' },
  { to: '/dashboard/patterns', icon: Target, label: 'Patterns' },
  { to: '/dashboard/rankings', icon: Trophy, label: 'Rankings' },
  { to: '/dashboard/analysis', icon: Layers, label: 'Analysis' },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { games, selectedGameId, selectedGame, setSelectedGameId, gamesLoading, setSearchQuery, searchQuery } =
    useDashboard();
  const theme = getGameTheme(selectedGame?.slug);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate('/dashboard/analysis');
  }

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground variant="app" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center border-r border-surface-border/70 bg-surface/80 py-5 backdrop-blur-xl md:flex">
        <TikiTakaLogo size={42} />
        <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                `flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                  isActive
                    ? 'nav-active'
                    : 'text-slate-400 hover:bg-surface-elevated hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-2">
          <NavLink
            to="/settings/accounts"
            title="Settings"
            className={({ isActive }) =>
              `flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                isActive ? 'nav-active' : 'text-slate-400 hover:bg-surface-elevated hover:text-white'
              }`
            }
          >
            <Settings className="h-5 w-5" />
          </NavLink>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-surface-border/60 bg-surface/70 backdrop-blur-xl md:ml-[84px]">
        <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
          <div className="hidden min-w-0 lg:block">
            <p className="label-kicker">{theme.shortLabel}</p>
            <p className="truncate font-display text-sm font-bold text-white">{theme.tagline}</p>
          </div>

          <form onSubmit={handleSearch} className="relative mx-auto hidden max-w-xl flex-1 md:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search patterns, players, matches"
              className="w-full rounded-full border border-surface-border bg-surface-raised/80 py-2.5 pl-11 pr-4 text-sm text-white outline-none transition focus:border-accent/50 focus:shadow-glow-sm"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <GameSelector
              games={games}
              selectedId={selectedGameId}
              onChange={setSelectedGameId}
              loading={gamesLoading}
            />
            <LiveClock />
            <button
              type="button"
              className="relative rounded-full border border-surface-border bg-surface-raised p-2 text-slate-400 transition hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
            {user ? (
              <div className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised py-1 pl-1 pr-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 font-display text-xs font-bold text-accent">
                    {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="hidden max-w-[120px] truncate text-sm font-semibold text-white sm:block">
                  {user.displayName ?? user.email}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-6 sm:px-6 md:ml-[84px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-surface-border/70 bg-surface/90 px-1 py-2 backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] uppercase tracking-wider ${
                isActive ? 'text-accent' : 'text-slate-500'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
