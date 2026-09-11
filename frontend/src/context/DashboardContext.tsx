import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useGames, useLeaderboard, usePatterns, usePersonalLatestMatch } from '../hooks/useDashboardData';
import { applyGameTheme } from '../lib/gameTheme';
import type { Game, LeaderboardEntry, MatchAnalysis, OAuthProvider, TacticalPattern } from '../types/api';

interface DashboardContextValue {
  games: Game[];
  gamesLoading: boolean;
  gamesError: string | null;
  selectedGameId: number | null;
  selectedGame: Game | undefined;
  setSelectedGameId: (id: number) => void;
  hasLinkedAccount: boolean;
  linkedProviders: OAuthProvider[];
  patterns: TacticalPattern[];
  patternsError: string | null;
  leaderboard: LeaderboardEntry[];
  leaderboardError: string | null;
  latestMatch: MatchAnalysis | null;
  latestMatchLoading: boolean;
  latestMatchError: string | null;
  analyzing: boolean;
  polling: boolean;
  insightsReady: boolean;
  refetchLatestMatch: () => void;
  dismissInsightsReady: () => void;
  selectedPattern: TacticalPattern | null;
  setSelectedPattern: (pattern: TacticalPattern | null) => void;
  highlightedSlug: string | null;
  setHighlightedSlug: (slug: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  stats: {
    patternCount: number;
    totalSamples: number;
    avgWinRate: number;
    topPattern: TacticalPattern | null;
    userRank: number | null;
    leaderboardCount: number;
  };
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: games, loading: gamesLoading, error: gamesError } = useGames();
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<TacticalPattern | null>(null);
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedGame = games.find((game) => game.id === selectedGameId);
  const hasLinkedAccount = Boolean(
    user?.gameAccounts.some((account) => account.gameId === selectedGameId),
  );
  const linkedProviders = user?.linkedAccounts.map((account) => account.provider) ?? [];

  const { data: patterns, error: patternsError } = usePatterns(selectedGameId);
  const { data: leaderboard, error: leaderboardError } = useLeaderboard(selectedGameId);
  const {
    data: latestMatch,
    loading: latestMatchLoading,
    error: latestMatchError,
    analyzing,
    polling,
    insightsReady,
    refetch: refetchLatestMatch,
    dismissInsightsReady,
  } = usePersonalLatestMatch(selectedGameId, hasLinkedAccount);

  useEffect(() => {
    if (games.length > 0 && selectedGameId === null) {
      setSelectedGameId(games[0].id);
    }
  }, [games, selectedGameId]);

  useEffect(() => {
    applyGameTheme(selectedGame?.slug);
  }, [selectedGame?.slug]);

  useEffect(() => {
    setSelectedPattern(null);
    setHighlightedSlug(null);
  }, [selectedGameId]);

  const stats = useMemo(() => {
    const patternCount = patterns.length;
    const totalSamples = patterns.reduce((sum, pattern) => sum + pattern.sampleSize, 0);
    const avgWinRate =
      patternCount > 0
        ? patterns.reduce((sum, pattern) => sum + Number(pattern.winRate), 0) / patternCount
        : 0;
    const topPattern =
      patternCount > 0
        ? [...patterns].sort((a, b) => Number(b.winRate) - Number(a.winRate))[0]
        : null;
    const userRank = leaderboard.find((entry) => entry.currentUser)?.rank ?? null;

    return {
      patternCount,
      totalSamples,
      avgWinRate,
      topPattern,
      userRank,
      leaderboardCount: leaderboard.length,
    };
  }, [patterns, leaderboard]);

  const value = useMemo(
    () => ({
      games,
      gamesLoading,
      gamesError,
      selectedGameId,
      selectedGame,
      setSelectedGameId,
      hasLinkedAccount,
      linkedProviders,
      patterns,
      patternsError,
      leaderboard,
      leaderboardError,
      latestMatch,
      latestMatchLoading,
      latestMatchError,
      analyzing,
      polling,
      insightsReady,
      refetchLatestMatch,
      dismissInsightsReady,
      selectedPattern,
      setSelectedPattern,
      highlightedSlug,
      setHighlightedSlug,
      searchQuery,
      setSearchQuery,
      stats,
    }),
    [
      games,
      gamesLoading,
      gamesError,
      selectedGameId,
      selectedGame,
      hasLinkedAccount,
      linkedProviders,
      patterns,
      patternsError,
      leaderboard,
      leaderboardError,
      latestMatch,
      latestMatchLoading,
      latestMatchError,
      analyzing,
      polling,
      insightsReady,
      refetchLatestMatch,
      dismissInsightsReady,
      selectedPattern,
      highlightedSlug,
      searchQuery,
      stats,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
