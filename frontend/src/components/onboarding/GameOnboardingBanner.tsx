import { Link2, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ApiError, linkFaceitByNickname, linkRiotById } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useOAuthProviders } from '../../hooks/useOAuthProviders';
import {
  GAME_LINK_REQUIREMENTS,
  PROVIDER_LABELS,
  PROVIDER_STYLES,
  providerLogoOnBrandButton,
  startProviderLink,
} from '../../lib/oauth';
import type { Game, OAuthProvider } from '../../types/api';
import { OAuthProviderIcon } from '../auth/OAuthProviderIcon';
import { EsportsCard } from '../ui/EsportsCard';

interface GameOnboardingBannerProps {
  game: Game;
  linkedProviders: OAuthProvider[];
  hasGameAccount: boolean;
}

export function GameOnboardingBanner({
  game,
  linkedProviders,
  hasGameAccount,
}: GameOnboardingBannerProps) {
  const { refreshUser } = useAuth();
  const [linking, setLinking] = useState<OAuthProvider | 'riot-id' | 'faceit-nick' | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [riotId, setRiotId] = useState('');
  const [riotTag, setRiotTag] = useState('');
  const [faceitNickname, setFaceitNickname] = useState('');
  const {
    providers: configuredProviders,
    riotIdLink,
    riotApiHealthy,
    riotApiStatusMessage,
    faceitNicknameLink,
  } = useOAuthProviders();
  const configuredProviderSet = new Set(configuredProviders);
  const requirements = GAME_LINK_REQUIREMENTS[game.slug];
  const isRiotGame = game.slug === 'valorant' || game.slug === 'lol';

  // Once connected, onboarding banner is hidden just like normal production
  if (!requirements || hasGameAccount) {
    if (
      hasGameAccount &&
      requirements &&
      isRiotGame &&
      riotIdLink &&
      !riotApiHealthy &&
      riotApiStatusMessage
    ) {
      return (
        <EsportsCard className="border-red-500/40 p-5">
          <p className="text-sm font-semibold text-red-200">Riot API is not working</p>
          <p className="mt-2 text-sm text-red-200/90">{riotApiStatusMessage}</p>
        </EsportsCard>
      );
    }
    return null;
  }

  const missingProviders = requirements.providers.filter(
    (provider) => !linkedProviders.includes(provider),
  );

  async function handleLink(provider: OAuthProvider) {
    if (!configuredProviderSet.has(provider)) {
      if (provider === 'RIOT' && riotIdLink) {
        return;
      }
      if (provider === 'FACEIT' && faceitNicknameLink) {
        return;
      }
      setLinkError(
        `${PROVIDER_LABELS[provider]} OAuth is not configured. Add client credentials to .env and restart the backend.`,
      );
      return;
    }
    setLinkError(null);
    setLinking(provider);
    try {
      await startProviderLink(provider);
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Failed to start provider link');
      setLinking(null);
    }
  }

  async function handleRiotIdLink() {
    setLinkError(null);
    setLinking('riot-id');
    try {
      const tag = riotTag.trim().replace(/^#+/, '');
      const result = await linkRiotById(riotId.trim(), tag, game.id);
      await refreshUser();
      if (result.matchSyncError) {
        setLinkError(result.matchSyncError.message);
      }
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Failed to link Riot ID');
    } finally {
      setLinking(null);
    }
  }

  async function handleFaceitNicknameLink() {
    setLinkError(null);
    setLinking('faceit-nick');
    try {
      await linkFaceitByNickname(faceitNickname.trim());
      await refreshUser();
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Failed to link Faceit profile');
    } finally {
      setLinking(null);
    }
  }

  if (missingProviders.length === 0) {
    return (
      <EsportsCard className="border-accent/30 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent-glow" />
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Account linked — syncing matches
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              We are polling for your latest {game.name} matches. This usually takes 1–3 minutes after you finish a game.
            </p>
          </div>
        </div>
      </EsportsCard>
    );
  }

  return (
    <EsportsCard className="border-accent/25 p-5">
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="flex-1">
          <p className="font-display text-sm font-bold uppercase tracking-wider text-white">{requirements.title}</p>
          <p className="mt-1 text-sm text-ink-muted">{requirements.description}</p>
          {riotIdLink && !riotApiHealthy && riotApiStatusMessage ? (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {riotApiStatusMessage}
            </p>
          ) : null}
          {linkError ? <p className="mt-2 text-sm text-red-300">{linkError}</p> : null}
          <div className="mt-4 flex flex-col gap-4">
            {missingProviders.map((provider) => {
              if (provider === 'RIOT' && (!configuredProviderSet.has('RIOT') || riotIdLink)) {
                return (
                  <div key={provider} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-ink-muted">
                      Riot ID
                      <input
                        value={riotId}
                        onChange={(e) => setRiotId(e.target.value)}
                        placeholder="Game name"
                        className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-ink-muted">
                      Tag
                      <input
                        value={riotTag}
                        onChange={(e) => setRiotTag(e.target.value)}
                        placeholder="3610"
                        className="w-24 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleRiotIdLink()}
                      disabled={linking !== null || !riotId.trim() || !riotTag.trim()}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${PROVIDER_STYLES.RIOT}`}
                    >
                      {linking === 'riot-id' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <OAuthProviderIcon provider="RIOT" className="h-4 w-4 brightness-0 invert" />
                      )}
                      Link with Riot ID
                    </button>
                  </div>
                );
              }

              if (provider === 'FACEIT' && !configuredProviderSet.has('FACEIT') && faceitNicknameLink) {
                return (
                  <div key={provider} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-ink-muted">
                      Faceit nickname
                      <input
                        value={faceitNickname}
                        onChange={(e) => setFaceitNickname(e.target.value)}
                        placeholder="Nickname"
                        className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleFaceitNicknameLink()}
                      disabled={linking !== null || !faceitNickname.trim()}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${PROVIDER_STYLES.FACEIT}`}
                    >
                      {linking === 'faceit-nick' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <OAuthProviderIcon provider="FACEIT" className="h-4 w-4 brightness-0 invert" />
                      )}
                      Link Faceit for CS2
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => handleLink(provider)}
                  disabled={linking !== null}
                  className={`inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${PROVIDER_STYLES[provider]}`}
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
              );
            })}
          </div>
        </div>
      </div>
    </EsportsCard>
  );
}
