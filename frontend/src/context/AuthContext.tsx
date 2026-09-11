import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { MeResponse } from '../types/api';
import { getCurrentUser } from '../api/client';
import { getStoredToken, setStoredToken } from '../lib/authStorage';

interface AuthContextValue {
  token: string | null;
  user: MeResponse | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const setToken = useCallback((nextToken: string | null) => {
    setStoredToken(nextToken);
    setTokenState(nextToken);
    if (!nextToken) {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const me = await getCurrentUser();
      setUser(me);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [setToken, token]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = useCallback(() => {
    setToken(null);
  }, [setToken]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      setToken,
      refreshUser,
      logout,
    }),
    [token, user, loading, setToken, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
