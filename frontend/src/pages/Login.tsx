import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ApiError, login } from '../api/client';
import { AuthFormField } from '../components/auth/AuthFormField';
import { OAuthIconButton } from '../components/auth/OAuthIconButton';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useOAuthProviders } from '../hooks/useOAuthProviders';
import { detectUserLocation } from '../lib/location';
import { startOAuthLogin } from '../lib/oauth';
import type { AuthResponse } from '../types/api';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAUTH_NOT_CONFIGURED: 'That sign-in provider is not configured yet. Ask an admin to add its client credentials.',
  OAUTH_DENIED: 'Sign-in was cancelled or denied by the provider.',
  OAUTH_CALLBACK_INVALID: 'The provider callback was invalid. Please try again.',
  OAUTH_STATE_INVALID: 'Your sign-in session expired. Please try again.',
  OAUTH_PROFILE_INCOMPLETE: 'The provider did not return the profile details needed to sign in.',
  OAUTH_VERIFICATION_FAILED: 'The provider could not verify this sign-in. Please try again.',
  EMAIL_EXISTS: 'An account with this email already exists. Sign in or reset your password.',
  OAUTH_FAILED: 'Sign-in with this provider failed. Please try again.',
};

export function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, loading, setToken } = useAuth();
  const { providers: oauthProviders, loading: oauthLoading, loadError: oauthLoadError, reload: reloadOAuthProviders } =
    useOAuthProviders();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [redirectOAuthError, setRedirectOAuthError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('error') || (location.state as { error?: string } | null)?.error;
    const message = searchParams.get('message');
    if (!code && !message) {
      return;
    }

    if (code && OAUTH_ERROR_MESSAGES[code]) {
      setRedirectOAuthError(OAUTH_ERROR_MESSAGES[code]);
    } else {
      setRedirectOAuthError(message || 'Sign-in failed. Please try again.');
    }

    navigate({ pathname: location.pathname, search: '' }, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-slate-400"
        >
          Loading your session…
        </motion.div>
      </div>
    );
  }

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  function completeAuth(response: AuthResponse) {
    setToken(response.token);
    navigate('/dashboard', { replace: true });
  }

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const detectedLocation = await detectUserLocation();
      const response = await login(loginId, password, detectedLocation || undefined);
      completeAuth(response);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOAuthClick(provider: (typeof oauthProviders)[number]) {
    setFormError(null);
    startOAuthLogin(provider);
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your tactical match insights"
    >
      {redirectOAuthError ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {redirectOAuthError}
        </div>
      ) : null}

      {formError ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {formError}
        </div>
      ) : null}

      <div className="mb-6">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
          Quick sign in
        </p>
        {oauthLoading ? (
          <p className="text-center text-xs text-slate-500">Loading sign-in options…</p>
        ) : oauthLoadError ? (
          <div className="space-y-2 text-center">
            <p className="text-xs text-red-300">{oauthLoadError}</p>
            <button
              type="button"
              onClick={() => void reloadOAuthProviders()}
              className="text-xs font-medium text-accent-glow transition hover:text-accent"
            >
              Retry
            </button>
          </div>
        ) : oauthProviders.length > 0 ? (
          <div className="flex items-center justify-center gap-3">
            {oauthProviders.map((provider, index) => (
              <OAuthIconButton
                key={provider}
                provider={provider}
                disabled={submitting}
                index={index}
                onClick={() => handleOAuthClick(provider)}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-slate-500">
            Use your email and password below. Social sign-in becomes available once an admin adds provider credentials.
          </p>
        )}
      </div>

      {oauthProviders.length > 0 ? (
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-surface-border" />
          <span className="text-xs uppercase tracking-widest text-slate-600">or</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-surface-border" />
        </div>
      ) : null}

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <AuthFormField
          id="login"
          label="Email or username"
          type="text"
          autoComplete="username"
          required
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
        />
        <AuthFormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-accent-glow transition hover:text-accent">
            Forgot password?
          </Link>
        </div>
        <motion.button
          type="submit"
          disabled={submitting}
          whileHover={{ scale: submitting ? 1 : 1.01 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
          className="btn-primary w-full"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </motion.button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{' '}
        <Link to="/register" className="font-semibold text-accent-glow transition hover:text-accent">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
