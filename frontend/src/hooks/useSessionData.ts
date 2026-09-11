import { useCallback, useEffect, useState } from 'react';
import { getAuthSessions, getGameSessions } from '../api/client';
import { getDaysAgo } from '../lib/sessionUtils';
import type { AuthSession, GameSession } from '../types/api';

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

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

const SESSION_LOOKBACK_DAYS = 7;
const HEATMAP_LOOKBACK_DAYS = 365;

export function useGameSessions(gameId: number | null, hasLinkedAccount: boolean) {
  return useAsync(
    () => {
      if (gameId === null || !hasLinkedAccount) {
        return Promise.resolve([] as GameSession[]);
      }

      return getGameSessions({
        gameId,
        from: getDaysAgo(SESSION_LOOKBACK_DAYS).toISOString(),
        to: new Date().toISOString(),
      });
    },
    [] as GameSession[],
    [gameId, hasLinkedAccount],
  );
}

export function useGameSessionsHeatmap(gameId: number | null, hasLinkedAccount: boolean) {
  return useAsync(
    () => {
      if (gameId === null || !hasLinkedAccount) {
        return Promise.resolve([] as GameSession[]);
      }

      return getGameSessions({
        gameId,
        from: getDaysAgo(HEATMAP_LOOKBACK_DAYS).toISOString(),
        to: new Date().toISOString(),
      });
    },
    [] as GameSession[],
    [gameId, hasLinkedAccount],
  );
}

export function useAuthSessions() {
  return useAsync(getAuthSessions, [] as AuthSession[], []);
}
