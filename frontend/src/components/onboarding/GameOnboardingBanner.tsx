import { Link2, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../api/client';
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
  const [linking, setLinking] = useState<OAuthProvider | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const requirements = GAME_LINK_REQUIREMENTS[game.slug];

  if (!requirements || hasGameAccount) {
    return null;
  }

  const missingProviders = requirements.providers.filter(
    (provider) => !linkedProviders.includes(provider),
  );

  async function handleLink(provider: OAuthProvider) {
    setLinkError(null);
    setLinking(provider);
    try {
      await startProviderLink(provider);
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Failed to start provider link');
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
          {linkError ? <p className="mt-2 text-sm text-red-300">{linkError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {missingProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => handleLink(provider)}
                disabled={linking !== null}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${PROVIDER_STYLES[provider]}`}
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
        </div>
      </div>
    </EsportsCard>
  );
}
