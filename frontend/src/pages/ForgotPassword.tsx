import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ApiError, forgotPassword, resetPassword } from '../api/client';
import { AuthFormField } from '../components/auth/AuthFormField';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../context/AuthContext';

type Step = 'request' | 'reset' | 'done';

export function ForgotPassword() {
  const navigate = useNavigate();
  const { token, loading } = useAuth();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setInfo('If an account exists for that email, a 6-digit code was sent. Enter it below.');
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a reset code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim(), otp.trim(), newPassword);
      setStep('done');
      setInfo('Your password was updated. You can now sign in.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={step === 'done' ? 'Password updated' : 'Reset password'}
      subtitle={
        step === 'request'
          ? 'We will email a one-time code to verify it is you'
          : step === 'reset'
            ? 'Enter the code from your email and choose a new password'
            : 'Your account password has been saved'
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-glow">
          {info}
        </div>
      ) : null}

      {step === 'request' ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <AuthFormField
            id="reset-email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <motion.button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'Sending code…' : 'Send reset code'}
          </motion.button>
        </form>
      ) : null}

      {step === 'reset' ? (
        <form onSubmit={handleReset} className="space-y-4">
          <AuthFormField
            id="reset-otp"
            label="Email code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
          />
          <AuthFormField
            id="reset-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            hint="At least 8 characters"
          />
          <motion.button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'Updating password…' : 'Update password'}
          </motion.button>
        </form>
      ) : null}

      {step === 'done' ? (
        <motion.button
          type="button"
          className="btn-primary w-full"
          onClick={() => navigate('/login', { replace: true })}
        >
          Back to sign in
        </motion.button>
      ) : null}

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-accent-glow transition hover:text-accent">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
