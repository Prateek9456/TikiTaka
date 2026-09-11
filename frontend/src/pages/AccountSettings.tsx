import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Unlink,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, unlinkProvider } from '../api/client';
import { GameLogo } from '../components/brand/GameLogo';
import { OAuthProviderIcon } from '../components/auth/OAuthProviderIcon';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useGames } from '../hooks/useDashboardData';
import { useOAuthProviders } from '../hooks/useOAuthProviders';
import {
  ALL_OAUTH_PROVIDERS,
  GAME_LINK_REQUIREMENTS,
  PROVIDER_DESCRIPTIONS,
  PROVIDER_LABELS,
  PROVIDER_STYLES,
  providerLogoOnBrandButton,
  startProviderLink,
} from '../lib/oauth';
import type { Game, LinkedAccountSummary, OAuthProvider } from '../types/api';

type GameAccountStatus = 'connected' | 'syncing' | 'partial' | 'not_connected';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateId(id: string, max = 16) {
  if (id.length <= max) {
    return id;
  }
  return `${id.slice(0, max)}…`;
}

function getGameAccountStatus(
  game: Game,
  linkedProviders: OAuthProvider[],
  hasGameAccount: boolean,
): GameAccountStatus {
  const requirements = GAME_LINK_REQUIREMENTS[game.slug];
  if (!requirements) {
    return 'not_connected';
  }

  if (hasGameAccount) {
    return 'connected';
  }

  const missingProviders = requirements.providers.filter(
    (provider) => !linkedProviders.includes(provider),
  );

  if (missingProviders.length === 0) {
    return 'syncing';
  }

  const linkedCount = requirements.providers.length - missingProviders.length;
  if (linkedCount > 0) {
    return 'partial';
  }

  return 'not_connected';
}

const STATUS_CONFIG: Record<
  GameAccountStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  connected: {
    label: 'Connected',
    icon: CheckCircle2,
    className: 'text-accent-glow',
  },
  syncing: {
    label: 'Syncing',
    icon: Clock,
    className: 'text-amber-300',
  },
  partial: {
    label: 'Setup incomplete',
    icon: AlertCircle,
    className: 'text-amber-300',
  },
  not_connected: {
    label: 'Not connected',
    icon: AlertCircle,
    className: 'text-slate-500',
  },
};

function ProviderCard({
  provider,
  linkedAccount,
  configured,
  onLink,
  onUnlink,
  linking,
  unlinking,
}: {
  provider: OAuthProvider;
  linkedAccount: LinkedAccountSummary | undefined;
  configured: boolean;
  onLink: (provider: OAuthProvider) => void;
  onUnlink: (provider: OAuthProvider) => void;
  linking: OAuthProvider | null;
  unlinking: OAuthProvider | null;
}) {
  const isLinked = Boolean(linkedAccount);
  const isLinking = linking === provider;
  const isUnlinking = unlinking === provider;

  return (
    <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {linkedAccount?.avatarUrl ? (
          <img
            src={linkedAccount.avatarUrl}
            alt=""
            className="h-12 w-12 rounded-xl border border-surface-border object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-surface-border bg-slate-900">
            <OAuthProviderIcon provider={provider} className="h-6 w-6" />
          </div>
        )}
        <div>
          <p className="font-medium text-white">{PROVIDER_LABELS[provider]}</p>
          <p className="mt-0.5 text-sm text-slate-500">{PROVIDER_DESCRIPTIONS[provider]}</p>
          {isLinked ? (
            <p className="mt-1 text-sm text-slate-400">
              {linkedAccount?.displayName ?? 'Linked account'}
              {linkedAccount?.linkedAt ? ` · since ${formatDate(linkedAccount.linkedAt)}` : ''}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Not linked</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        {isLinked ? (
          <button
            type="button"
            onClick={() => onUnlink(provider)}
            disabled={isUnlinking}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUnlinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4" />
            )}
            Unlink
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onLink(provider)}
            disabled={isLinking || !configured}
            title={
              configured
                ? undefined
                : 'This provider is not configured on the server yet. Add its OAuth client credentials to .env.'
            }
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${PROVIDER_STYLES[provider]}`}
          >
            {isLinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <OAuthProviderIcon
                provider={provider}
                className={`h-4 w-4 ${providerLogoOnBrandButton(provider)}`}
              />
            )}
            {configured ? `Link ${PROVIDER_LABELS[provider]}` : 'Not configured'}
          </button>
        )}
      </div>
    </div>
  );
}

function GameAccountCard({
  game,
  status,
  gameAccount,
  missingProviders,
  onLinkProvider,
  linking,
}: {
  game: Game;
  status: GameAccountStatus;
  gameAccount: { externalPlayerId: string } | undefined;
  missingProviders: OAuthProvider[];
  onLinkProvider: (provider: OAuthProvider) => void;
  linking: OAuthProvider | null;
}) {
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;
  const requirements = GAME_LINK_REQUIREMENTS[game.slug];

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <GameLogo slug={game.slug} size={28} />
            <h3 className="font-medium text-white">{game.name}</h3>
            <span className={`inline-flex items-center gap-1 text-xs ${statusConfig.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig.label}
            </span>
          </div>

          {gameAccount ? (
            <p className="mt-2 font-mono text-xs text-slate-500">
              Player ID: {truncateId(gameAccount.externalPlayerId)}
            </p>
          ) : null}

          {status === 'syncing' && requirements ? (
            <p className="mt-2 text-sm text-slate-400">
              Account linked — we are polling for your latest {game.name} matches. This usually
              takes 1–3 minutes after you finish a game.
            </p>
          ) : null}

          {status === 'partial' && requirements ? (
            <p className="mt-2 text-sm text-slate-400">{requirements.description}</p>
          ) : null}

          {status === 'not_connected' && requirements ? (
            <p className="mt-2 text-sm text-slate-400">{requirements.description}</p>
          ) : null}
        </div>
      </div>

      {missingProviders.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-border pt-4">
          {missingProviders.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => onLinkProvider(provider)}
              disabled={linking === provider}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${PROVIDER_STYLES[provider]}`}
            >
              {linking === provider ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <OAuthProviderIcon
                  provider={provider}
                  className={`h-4 w-4 ${providerLogoOnBrandButton(provider)}`}
                />
              )}
              Link {PROVIDER_LABELS[provider]}
              {game.slug === 'cs2' && provider === 'FACEIT' ? ' for CS2' : ''}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const { data: games, loading: gamesLoading } = useGames();
  const { providers: configuredProviders } = useOAuthProviders();
  const [searchParams, setSearchParams] = useSearchParams();
  const [linking, setLinking] = useState<OAuthProvider | null>(null);
  const [unlinking, setUnlinking] = useState<OAuthProvider | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [linkedToast, setLinkedToast] = useState<string | null>(null);

  const linkedProviders = useMemo(
    () => user?.linkedAccounts.map((account) => account.provider) ?? [],
    [user],
  );

  const configuredProviderSet = useMemo(
    () => new Set(configuredProviders),
    [configuredProviders],
  );

  const linkedByProvider = useMemo(() => {
    const map = new Map<OAuthProvider, LinkedAccountSummary>();
    user?.linkedAccounts.forEach((account) => {
      map.set(account.provider, account);
    });
    return map;
  }, [user]);

  useEffect(() => {
    const linked = searchParams.get('linked');
    if (!linked) {
      return;
    }

    const providerKey = linked.toUpperCase() as OAuthProvider;
    const label = PROVIDER_LABELS[providerKey] ?? linked;

    void refreshUser().then(() => {
      setLinkedToast(`${label} linked successfully`);
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, setSearchParams, refreshUser]);

  async function handleLink(provider: OAuthProvider) {
    if (!configuredProviderSet.has(provider)) {
      setActionError(
        `${PROVIDER_LABELS[provider]} OAuth is not configured yet. Add its client credentials to .env and restart the backend.`,
      );
      return;
    }

    setActionError(null);
    setLinking(provider);
    try {
      await startProviderLink(provider);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to start provider link');
      setLinking(null);
    }
  }

  async function handleUnlink(provider: OAuthProvider) {
    if (!window.confirm(`Unlink ${PROVIDER_LABELS[provider]} from your account?`)) {
      return;
    }

    setActionError(null);
    setUnlinking(provider);
    try {
      await unlinkProvider(provider);
      await refreshUser();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to unlink provider');
    } finally {
      setUnlinking(null);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl pb-20">
      {linkedToast ? (
        <Toast
          title="Account linked"
          message={linkedToast}
          onDismiss={() => setLinkedToast(null)}
        />
      ) : null}

      <div className="mb-8 flex items-center gap-3">
        <Link
          to="/dashboard"
          className="rounded-xl border border-surface-border p-2 text-slate-400 transition hover:border-accent/40 hover:text-white"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="label-kicker">Profile</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Account settings</h1>
          <p className="text-sm text-ink-muted">Manage linked providers and game accounts</p>
        </div>
      </div>

      <div>
        {actionError ? (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {actionError}
          </div>
        ) : null}

        <section className="mb-8">
          <div className="card flex items-center gap-4 p-5">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-14 w-14 rounded-xl border border-surface-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-surface-border bg-slate-900 text-lg font-semibold text-slate-400">
                {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium text-white">{user.displayName ?? user.email}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <p className="mt-1 text-xs text-slate-600">
                {user.linkedAccounts.length} provider{user.linkedAccounts.length === 1 ? '' : 's'}{' '}
                linked · {user.gameAccounts.length} game account
                {user.gameAccounts.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
            Linked providers
          </h2>
          <div className="space-y-3">
            {ALL_OAUTH_PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider}
                provider={provider}
                linkedAccount={linkedByProvider.get(provider)}
                configured={configuredProviderSet.has(provider)}
                onLink={handleLink}
                onUnlink={handleUnlink}
                linking={linking}
                unlinking={unlinking}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500">
            Game accounts
          </h2>
          {gamesLoading ? (
            <div className="card flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading games…
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const requirements = GAME_LINK_REQUIREMENTS[game.slug];
                const gameAccount = user.gameAccounts.find((account) => account.gameId === game.id);
                const hasGameAccount = Boolean(gameAccount);
                const status = getGameAccountStatus(game, linkedProviders, hasGameAccount);
                const missingProviders =
                  requirements?.providers.filter(
                    (provider) =>
                      !linkedProviders.includes(provider) && configuredProviderSet.has(provider),
                  ) ?? [];

                return (
                  <GameAccountCard
                    key={game.id}
                    game={game}
                    status={status}
                    gameAccount={gameAccount}
                    missingProviders={hasGameAccount ? [] : missingProviders}
                    onLinkProvider={handleLink}
                    linking={linking}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
