import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Unlink,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  linkFaceitByNickname,
  linkRiotById,
  syncMyMatches,
  unlinkGameAccount,
  unlinkProvider,
} from '../api/client';
import { GameLogo } from '../components/brand/GameLogo';
import { OAuthProviderIcon } from '../components/auth/OAuthProviderIcon';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useGames } from '../hooks/useDashboardData';
import { useOAuthProviders } from '../hooks/useOAuthProviders';
import {
  ALL_OAUTH_PROVIDERS,
  PROVIDER_DESCRIPTIONS,
  PROVIDER_LABELS,
  PROVIDER_STYLES,
  providerLogoOnBrandButton,
  startProviderLink,
} from '../lib/oauth';
import type { Game, LinkedAccountSummary, OAuthProvider, UserGameAccountSummary } from '../types/api';

type GameAccountStatus = 'connected' | 'syncing' | 'not_connected';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateId(id: string, max = 20) {
  if (id.length <= max) {
    return id;
  }
  return `${id.slice(0, max)}…`;
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
            <div className="mt-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-sm text-slate-400">
                {linkedAccount?.displayName ?? 'Linked account'}
                {linkedAccount?.linkedAt ? ` · since ${formatDate(linkedAccount.linkedAt)}` : ''}
              </span>
              {linkedAccount?.providerUserId ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500">
                  <KeyRound className="h-3 w-3 text-slate-600" />
                  ID: {truncateId(linkedAccount.providerUserId, 24)}
                </span>
              ) : null}
            </div>
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
                : 'This provider is not configured on the server yet. Add its OAuth credentials to .env.'
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
  gameAccount,
  onLinkSteam,
  onLinkRiot,
  onLinkFaceit,
  onUnlinkGame,
  isUnlinking,
  isLinking,
}: {
  game: Game;
  gameAccount: UserGameAccountSummary | undefined;
  onLinkSteam: () => void;
  onLinkRiot: (gameName: string, tagLine: string) => Promise<void>;
  onLinkFaceit: (nickname: string) => Promise<void>;
  onUnlinkGame: (gameId: number) => Promise<void>;
  isUnlinking: boolean;
  isLinking: boolean;
}) {
  const isConnected = Boolean(gameAccount);
  const status: GameAccountStatus = isConnected ? 'connected' : 'not_connected';
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  const [riotId, setRiotId] = useState('');
  const [riotTag, setRiotTag] = useState('');
  const [faceitNick, setFaceitNick] = useState('');
  const [submittingRiot, setSubmittingRiot] = useState(false);
  const [submittingFaceit, setSubmittingFaceit] = useState(false);

  async function handleRiotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!riotId.trim() || !riotTag.trim()) {
      return;
    }
    setSubmittingRiot(true);
    try {
      await onLinkRiot(riotId.trim(), riotTag.trim().replace(/^#+/, ''));
      setRiotId('');
      setRiotTag('');
    } finally {
      setSubmittingRiot(false);
    }
  }

  async function handleFaceitSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!faceitNick.trim()) {
      return;
    }
    setSubmittingFaceit(true);
    try {
      await onLinkFaceit(faceitNick.trim());
      setFaceitNick('');
    } finally {
      setSubmittingFaceit(false);
    }
  }

  // Extract connection details from metadata or externalPlayerId
  const riotIdLabel = gameAccount?.metadata?.['riot-id'];
  const steamId = gameAccount?.metadata?.['steam-id'];
  const faceitNickLabel = gameAccount?.metadata?.nickname;
  const dotaAccountId = gameAccount?.metadata?.['dota-account-id'] || (game.slug === 'dota2' ? gameAccount?.externalPlayerId : undefined);
  const region = gameAccount?.metadata?.region;

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <GameLogo slug={game.slug} size={30} />
            <div>
              <h3 className="font-medium text-white">{game.name}</h3>
              <p className="text-xs text-slate-500">
                {game.slug === 'dota2' && 'Connects via Steam'}
                {game.slug === 'cs2' && 'Connects via Faceit or Steam'}
                {(game.slug === 'valorant' || game.slug === 'lol') && 'Connects via Riot ID & Game Tag'}
              </p>
            </div>
            <span className={`ml-auto sm:ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-surface-border ${statusConfig.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig.label}
            </span>
          </div>

          {isConnected && gameAccount ? (
            <div className="mt-3 rounded-lg border border-surface-border bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                {/* Riot games */}
                {(game.slug === 'valorant' || game.slug === 'lol') && (
                  <>
                    <div>
                      <span className="text-slate-500">Connection ID (Riot ID):</span>{' '}
                      <span className="font-semibold text-white">{riotIdLabel || 'Connected'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">PUUID:</span>{' '}
                      <span className="font-mono text-slate-400">{truncateId(gameAccount.externalPlayerId, 16)}</span>
                    </div>
                    {region ? (
                      <div>
                        <span className="text-slate-500">Cluster:</span>{' '}
                        <span className="font-mono uppercase text-slate-300">{region}</span>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Dota 2 */}
                {game.slug === 'dota2' && (
                  <>
                    <div>
                      <span className="text-slate-500">Connection ID (Steam ID):</span>{' '}
                      <span className="font-mono text-slate-300">{steamId || truncateId(gameAccount.externalPlayerId, 16)}</span>
                    </div>
                    {dotaAccountId ? (
                      <div>
                        <span className="text-slate-500">Dota Account ID:</span>{' '}
                        <span className="font-mono text-slate-400">{dotaAccountId}</span>
                      </div>
                    ) : null}
                  </>
                )}

                {/* CS2 */}
                {game.slug === 'cs2' && (
                  <>
                    {faceitNickLabel ? (
                      <div>
                        <span className="text-slate-500">Connection ID (Faceit):</span>{' '}
                        <span className="font-semibold text-white">{faceitNickLabel}</span>
                      </div>
                    ) : null}
                    {steamId ? (
                      <div>
                        <span className="text-slate-500">Connection ID (Steam ID):</span>{' '}
                        <span className="font-mono text-slate-300">{steamId}</span>
                      </div>
                    ) : null}
                    {!faceitNickLabel && !steamId ? (
                      <div>
                        <span className="text-slate-500">Player ID:</span>{' '}
                        <span className="font-mono text-slate-400">{truncateId(gameAccount.externalPlayerId, 16)}</span>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Form to connect when not connected */}
          {!isConnected ? (
            <div className="mt-4 border-t border-surface-border pt-4">
              {(game.slug === 'valorant' || game.slug === 'lol') ? (
                <div>
                  <p className="text-xs text-slate-400 mb-2">
                    Enter your Riot ID and game tag to link match data for both <strong className="text-white">Valorant</strong> and <strong className="text-white">League of Legends</strong>.
                  </p>
                  <form onSubmit={handleRiotSubmit} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      Riot ID (Game Name)
                      <input
                        value={riotId}
                        onChange={(e) => setRiotId(e.target.value)}
                        placeholder="e.g. TenZ"
                        disabled={submittingRiot || isLinking}
                        className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-accent focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      Tag
                      <input
                        value={riotTag}
                        onChange={(e) => setRiotTag(e.target.value)}
                        placeholder="NA1"
                        disabled={submittingRiot || isLinking}
                        className="w-24 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-accent focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submittingRiot || isLinking || !riotId.trim() || !riotTag.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingRiot ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <OAuthProviderIcon provider="RIOT" className="h-4 w-4 brightness-0 invert" />
                      )}
                      Connect Riot ID
                    </button>
                  </form>
                </div>
              ) : null}

              {game.slug === 'dota2' ? (
                <div>
                  <p className="text-xs text-slate-400 mb-2">
                    Link your Steam account to establish your Steam ID and sync your Dota 2 matches.
                  </p>
                  <button
                    type="button"
                    onClick={onLinkSteam}
                    disabled={isLinking}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLinking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <OAuthProviderIcon provider="STEAM" className="h-4 w-4" />
                    )}
                    Connect via Steam
                  </button>
                </div>
              ) : null}

              {game.slug === 'cs2' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Connect your Faceit nickname (recommended for tactical round events) or connect your Steam profile.
                  </p>
                  <form onSubmit={handleFaceitSubmit} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      Faceit Nickname
                      <input
                        value={faceitNick}
                        onChange={(e) => setFaceitNick(e.target.value)}
                        placeholder="Faceit player nickname"
                        disabled={submittingFaceit || isLinking}
                        className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-accent focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submittingFaceit || isLinking || !faceitNick.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingFaceit ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <OAuthProviderIcon provider="FACEIT" className="h-4 w-4 brightness-0 invert" />
                      )}
                      Connect Faceit
                    </button>
                    <span className="text-xs text-slate-500 py-2">or</span>
                    <button
                      type="button"
                      onClick={onLinkSteam}
                      disabled={isLinking}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <OAuthProviderIcon provider="STEAM" className="h-4 w-4" />
                      Connect via Steam
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {isConnected ? (
          <div className="shrink-0 pt-1">
            <button
              type="button"
              onClick={() => onUnlinkGame(game.id)}
              disabled={isUnlinking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUnlinking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unlink className="h-3.5 w-3.5" />
              )}
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
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
  const [unlinkingGameId, setUnlinkingGameId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [linkedToast, setLinkedToast] = useState<string | null>(null);

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

    void refreshUser()
      .then(() => syncMyMatches(undefined, 10))
      .then((result) => {
        if (result.errors?.length) {
          setActionError(result.errors.map((e) => e.error).join(' '));
        }
        const count = result.matchesIngested;
        setLinkedToast(
          count > 0
            ? `${label} linked — pulled ${count} match${count === 1 ? '' : 'es'}`
            : `${label} linked successfully`,
        );
        setSearchParams({}, { replace: true });
      })
      .catch(() => {
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
      setLinkedToast(`${PROVIDER_LABELS[provider]} unlinked`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to unlink provider');
    } finally {
      setUnlinking(null);
    }
  }

  async function handleLinkRiot(gameName: string, tagLine: string) {
    setActionError(null);
    try {
      const result = await linkRiotById(gameName, tagLine);
      await refreshUser();
      if (result.matchSyncError) {
        setActionError(result.matchSyncError.message);
      } else {
        setLinkedToast(`Riot ID ${gameName}#${tagLine} connected to Valorant & LoL`);
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to connect Riot ID');
    }
  }

  async function handleLinkFaceit(nickname: string) {
    setActionError(null);
    try {
      await linkFaceitByNickname(nickname);
      await refreshUser();
      setLinkedToast(`Faceit profile ${nickname} connected to CS2`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to connect Faceit profile');
    }
  }

  async function handleUnlinkGame(gameId: number) {
    const game = games.find((g) => g.id === gameId);
    const gameName = game?.name || 'this game';
    const confirmMessage = (game?.slug === 'valorant' || game?.slug === 'lol')
      ? `Disconnect your Riot ID? This will disconnect both Valorant and League of Legends.`
      : `Disconnect your connected account from ${gameName}?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActionError(null);
    setUnlinkingGameId(gameId);
    try {
      await unlinkGameAccount(gameId);
      await refreshUser();
      setLinkedToast(`${gameName} disconnected`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to disconnect game account');
    } finally {
      setUnlinkingGameId(null);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl pb-20">
      {linkedToast ? (
        <Toast
          title="Account updated"
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
          <p className="text-sm text-ink-muted">Manage sign-in providers and game data connections</p>
        </div>
      </div>

      <div>
        {actionError ? (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {actionError}
          </div>
        ) : null}

        {/* User Summary */}
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
                {user.linkedAccounts.length} sign-in provider{user.linkedAccounts.length === 1 ? '' : 's'}{' '}
                linked · {user.gameAccounts.length} game account
                {user.gameAccounts.length === 1 ? '' : 's'} connected
              </p>
            </div>
          </div>
        </section>

        {/* Linked OAuth Providers (Steam, Google, Epic ONLY) */}
        <section className="mb-10">
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Linked Providers (OAuth Sign-In)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sign-in accounts used to authenticate with TikiTaka AI (Steam, Google, and Epic).
            </p>
          </div>
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

        {/* Game Accounts & Data Connections */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Game Accounts & Data Connections
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect your game profiles (Riot ID for Valorant & LoL, Steam for Dota 2, Faceit/Steam for CS2) to establish your connection IDs and pull match data.
            </p>
          </div>

          {gamesLoading ? (
            <div className="card flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading games…
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((game) => {
                const gameAccount = user.gameAccounts.find((account) => account.gameId === game.id);
                return (
                  <GameAccountCard
                    key={game.id}
                    game={game}
                    gameAccount={gameAccount}
                    onLinkSteam={() => handleLink('STEAM')}
                    onLinkRiot={handleLinkRiot}
                    onLinkFaceit={handleLinkFaceit}
                    onUnlinkGame={handleUnlinkGame}
                    isUnlinking={unlinkingGameId === game.id}
                    isLinking={linking !== null}
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
