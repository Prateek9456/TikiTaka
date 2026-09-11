import { FormEvent, useEffect, useState } from 'react';
import { ApiError, register } from '../../api/client';
import { detectUserLocation } from '../../lib/location';
import type { AuthResponse } from '../../types/api';

interface CreateAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onRegistered: (response: AuthResponse) => void;
}

export function CreateAccountDialog({ open, onClose, onRegistered }: CreateAccountDialogProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setDetectingLocation(true);
    setError(null);

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
  }, [open]);

  if (!open) {
    return null;
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
      onRegistered(response);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName('');
    setUsername('');
    setEmail('');
    setDateOfBirth('');
    setPassword('');
    setLocation('');
    setError(null);
  }

  function handleClose() {
    if (submitting) {
      return;
    }
    resetForm();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close create account dialog"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-6">
          <h2 id="create-account-title" className="text-xl font-semibold text-white">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Tell us a few details so you can sign back in anytime with email and password.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="register-name" className="mb-1.5 block text-sm text-slate-400">
              Name
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="register-username" className="mb-1.5 block text-sm text-slate-400">
              Username
            </label>
            <input
              id="register-username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="register-email" className="mb-1.5 block text-sm text-slate-400">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="register-dob" className="mb-1.5 block text-sm text-slate-400">
              Date of birth
            </label>
            <input
              id="register-dob"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="mb-1.5 block text-sm text-slate-400">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent"
            />
            <p className="mt-1.5 text-xs text-slate-500">At least 8 characters. Stored securely for future sign-ins.</p>
          </div>

          <div>
            <label htmlFor="register-location" className="mb-1.5 block text-sm text-slate-400">
              Location
            </label>
            <input
              id="register-location"
              type="text"
              autoComplete="address-level2"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={detectingLocation ? 'Detecting your location…' : 'City, Region, Country'}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {detectingLocation
                ? 'Fetching location automatically…'
                : 'Auto-detected. You can edit it if needed.'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || detectingLocation}
              className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
