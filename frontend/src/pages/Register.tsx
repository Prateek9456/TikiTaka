import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ApiError, register } from '../api/client';
import { AuthFormField } from '../components/auth/AuthFormField';
import { OAuthIconButton } from '../components/auth/OAuthIconButton';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useOAuthProviders } from '../hooks/useOAuthProviders';
import { detectUserLocation } from '../lib/location';
import { startOAuthLogin } from '../lib/oauth';
import type { AuthResponse } from '../types/api';

export function Register() {
  const navigate = useNavigate();
  const { token, loading, setToken } = useAuth();
  const { providers: oauthProviders, loading: oauthLoading, loadError: oauthLoadError, reload: reloadOAuthProviders } =
    useOAuthProviders();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectUserLocation()
      .then((detected) => {
        if (!cancelled && detected) {
          setLocation(detected);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetectingLocation(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-slate-400"
        >
          Loading…
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username.trim())) {
      setError('Username must be 3-32 characters and can only contain letters, numbers, and underscores.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!dateOfBirth) {
      setError('Please enter your date of birth.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await register({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
        password,
        dateOfBirth,
        location: location.trim() || undefined,
      });
      completeAuth(response);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_EXISTS') {
        setError('An account with this email already exists. Sign in or reset your password.');
      } else if (err instanceof ApiError && err.code === 'USERNAME_EXISTS') {
        setError('This username is already taken. Please choose another.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuthClick(provider: (typeof oauthProviders)[number]) {
    setError(null);
    startOAuthLogin(provider);
  }

  return (
    <AuthLayout
      title="Join TikiTaka"
      subtitle="Create your account and start analyzing your gameplay"
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mb-6">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
          Sign up with
        </p>
        {oauthLoading ? (
          <p className="text-center text-xs text-slate-500">Loading sign-up options…</p>
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
                onClick={() => void handleOAuthClick(provider)}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-slate-500">
            Create your account with the form below. Social sign-up becomes available once provider credentials are configured.
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthFormField
          id="register-name"
          label="Name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <AuthFormField
          id="register-username"
          label="Username"
          type="text"
          autoComplete="username"
          required
          minLength={3}
          maxLength={32}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          hint="Unique. Letters, numbers, and underscores only"
        />
        <AuthFormField
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthFormField
          id="register-dob"
          label="Date of birth"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
        />
        <AuthFormField
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="At least 8 characters"
        />
        <AuthFormField
          id="register-location"
          label="Location"
          type="text"
          autoComplete="address-level2"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder={detectingLocation ? 'Detecting location…' : 'City, Region, Country'}
        />

        <motion.button
          type="submit"
          disabled={submitting || detectingLocation}
          whileHover={{ scale: submitting ? 1 : 1.01 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
          className="btn-primary w-full"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </motion.button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-accent-glow transition hover:text-accent">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
