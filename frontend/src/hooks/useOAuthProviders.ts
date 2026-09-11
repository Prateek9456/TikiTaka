import { useCallback, useEffect, useState } from 'react';
import { getOAuthProviders } from '../api/client';
import type { OAuthProvider } from '../types/api';

const LOAD_RETRY_MS = 2_000;
const MAX_LOAD_ATTEMPTS = 8;

export function useOAuthProviders() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProviders = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);

    for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
      if (signal?.aborted) {
        return;
      }

      try {
        const configured = await getOAuthProviders();
        if (signal?.aborted) {
          return;
        }
        setProviders(configured);
        setLoadError(null);
        setLoading(false);
        return;
      } catch {
        if (attempt < MAX_LOAD_ATTEMPTS) {
          await new Promise((resolve) => window.setTimeout(resolve, LOAD_RETRY_MS));
          continue;
        }
      }
    }

    if (!signal?.aborted) {
      setProviders([]);
      setLoadError(
        'Could not load sign-in options. Make sure the backend is running, then retry.',
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadProviders(controller.signal);
    return () => controller.abort();
  }, [loadProviders]);

  return { providers, loading, loadError, reload: loadProviders };
}
