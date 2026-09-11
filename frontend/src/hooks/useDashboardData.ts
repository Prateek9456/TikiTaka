import { useCallback, useEffect, useRef, useState } from 'react';
import { getGames, getLeaderboard, getLatestMatch, getPatterns } from '../api/client';
import type { Game, LeaderboardEntry, MatchAnalysis, TacticalPattern } from '../types/api';

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 3 * 60_000;

function useAsync<T>(fetcher: () => Promise<T>, initial: T, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetcher();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, refetch };
}

export function useGames() {
  return useAsync(getGames, [] as Game[], []);
}

export function usePatterns(gameId: number | null) {
  return useAsync(
    () => {
      if (gameId === null) {
        return Promise.resolve([] as TacticalPattern[]);
      }
      return getPatterns(gameId).then((page) => page.content);
    },
    [] as TacticalPattern[],
    [gameId],
  );
}

export function useLeaderboard(gameId: number | null) {
  return useAsync(
    () => {
      if (gameId === null) {
        return Promise.resolve([] as LeaderboardEntry[]);
      }
      return getLeaderboard(gameId);
    },
    [] as LeaderboardEntry[],
    [gameId],
  );
}

export interface PersonalLatestMatchState {
  data: MatchAnalysis | null;
  loading: boolean;
  error: string | null;
  analyzing: boolean;
  polling: boolean;
  insightsReady: boolean;
  refetch: () => void;
  dismissInsightsReady: () => void;
}

export function usePersonalLatestMatch(
  gameId: number | null,
  hasLinkedAccount: boolean,
): PersonalLatestMatchState {
  const [data, setData] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [insightsReady, setInsightsReady] = useState(false);
  const [tick, setTick] = useState(0);
  const previousMatchIdRef = useRef<number | null>(null);

  const refetch = useCallback(() => setTick((n) => n + 1), []);
  const dismissInsightsReady = useCallback(() => setInsightsReady(false), []);

  useEffect(() => {
    if (gameId === null || !hasLinkedAccount) {
      setData(null);
      setLoading(false);
      setError(null);
      setAnalyzing(false);
      setPolling(false);
      previousMatchIdRef.current = null;
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startedAt = Date.now();
    previousMatchIdRef.current = null;

    function stopPolling() {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      if (!cancelled) {
        setPolling(false);
      }
    }

    function shouldContinuePolling(match: MatchAnalysis | null): boolean {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        return false;
      }
      if (!match) {
        return true;
      }
      if (match.patternOccurrenceCount > 0) {
        return false;
      }
      return true;
    }

    async function fetchMatch() {
      if (gameId === null) {
        return;
      }

      try {
        const match = await getLatestMatch(gameId);
        if (cancelled) {
          return;
        }

        setData(match);
        setError(null);

        if (match) {
          const hadPrevious = previousMatchIdRef.current !== null;
          const isNewMatch =
            hadPrevious && previousMatchIdRef.current !== match.matchId;
          const patternsReady = match.patternOccurrenceCount > 0;

          setAnalyzing(!patternsReady);
          if (isNewMatch && patternsReady) {
            setInsightsReady(true);
          }

          previousMatchIdRef.current = match.matchId;
        } else {
          setAnalyzing(false);
        }

        if (!shouldContinuePolling(match)) {
          stopPolling();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setPolling(true);
    setInsightsReady(false);
    void fetchMatch();

    intervalId = setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        stopPolling();
        return;
      }
      void fetchMatch();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [gameId, hasLinkedAccount, tick]);

  return {
    data,
    loading,
    error,
    analyzing,
    polling,
    insightsReady,
    refetch,
    dismissInsightsReady,
  };
}
