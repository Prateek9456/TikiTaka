import { ApiError } from '../api/client';
import { getStoredToken } from './authStorage';
import type { OAuthProvider } from '../types/api';

const API_BASE = '/api/v1';
const API_UNAVAILABLE =
  'Cannot reach the API yet. The Java backend can take several minutes to start after docker compose up. Wait until it is healthy, then retry.';

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '');
  if (configured) {
    return configured;
  }
  // Google/Riot callbacks and oauth_state cookies are bound to the API host
  // (localhost:8080), not the Vite dev server. Hitting the API directly avoids
  // Vite proxying the 302 to accounts.google.com (socket hang up).
  return import.meta.env.DEV ? 'http://localhost:8080' : '';
}

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  GOOGLE: 'Google',
  RIOT: 'Riot',
  STEAM: 'Steam',
  FACEIT: 'Faceit',
  EPIC: 'Epic',
};

export const PROVIDER_STYLES: Record<OAuthProvider, string> = {
  GOOGLE: 'bg-white text-slate-900 hover:bg-slate-100',
  RIOT: 'bg-red-600 text-white hover:bg-red-500',
  STEAM: 'bg-slate-800 text-white hover:bg-slate-700',
  FACEIT: 'bg-orange-500 text-white hover:bg-orange-400',
  EPIC: 'bg-slate-700 text-white hover:bg-slate-600',
};

export const PROVIDER_DESCRIPTIONS: Record<OAuthProvider, string> = {
  GOOGLE: 'Sign in to TikiTaka',
  RIOT: 'Valorant and League of Legends match data',
  STEAM: 'Dota 2 and CS2 player identity',
  FACEIT: 'CS2 tactical match events',
  EPIC: 'Sign in to TikiTaka',
};

export const ALL_OAUTH_PROVIDERS: OAuthProvider[] = [
  'GOOGLE',
  'RIOT',
  'STEAM',
  'FACEIT',
  'EPIC',
];

export const GAME_LINK_REQUIREMENTS: Record<
  string,
  { providers: OAuthProvider[]; title: string; description: string }
> = {
  dota2: {
    providers: ['STEAM'],
    title: 'Connect Steam for Dota 2',
    description: 'Link your Steam account so we can pull your Dota 2 match history.',
  },
  cs2: {
    providers: ['STEAM', 'FACEIT'],
    title: 'Connect Steam and Faceit for CS2',
    description:
      'Steam identifies your profile; Faceit provides tactical match events for analysis.',
  },
  valorant: {
    providers: ['RIOT'],
    title: 'Connect Riot for Valorant',
    description: 'Sign in with Riot to track your Valorant matches automatically.',
  },
  lol: {
    providers: ['RIOT'],
    title: 'Connect Riot for League of Legends',
    description: 'Sign in with Riot to track your LoL matches automatically.',
  },
};

export function oauthLoginHref(provider: OAuthProvider) {
  return `${apiOrigin()}${API_BASE}/auth/oauth/${provider.toLowerCase()}`;
}

function isRedirectStatus(status: number) {
  return status === 0 || status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchOAuthRedirect(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      ...init,
      redirect: 'manual',
      credentials: 'include',
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(API_UNAVAILABLE);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function startOAuthLogin(provider: OAuthProvider): Promise<void> {
  window.location.assign(oauthLoginHref(provider));
}

export const OAUTH_PROVIDER_COLORS: Record<OAuthProvider, string> = {
  GOOGLE: 'hover:border-white/30 hover:shadow-[0_0_20px_-4px_rgba(255,255,255,0.2)]',
  RIOT: 'hover:border-red-500/50 hover:shadow-[0_0_20px_-4px_rgba(239,68,68,0.4)]',
  STEAM: 'hover:border-slate-400/40 hover:shadow-[0_0_20px_-4px_rgba(148,163,184,0.3)]',
  FACEIT: 'hover:border-orange-500/50 hover:shadow-[0_0_20px_-4px_rgba(249,115,22,0.4)]',
  EPIC: 'hover:border-blue-400/40 hover:shadow-[0_0_20px_-4px_rgba(96,165,250,0.3)]',
};

export function providerLogoOnBrandButton(provider: OAuthProvider) {
  return provider === 'RIOT' || provider === 'FACEIT' ? 'brightness-0 invert' : '';
}

export async function startProviderLink(provider: OAuthProvider): Promise<void> {
  const token = getStoredToken();
  if (!token) {
    throw new ApiError('Not authenticated');
  }

  const href = `${apiOrigin()}${API_BASE}/auth/link/${provider.toLowerCase()}`;
  const csrfResponse = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
  let csrfToken = '';
  let csrfHeader = 'X-XSRF-TOKEN';
  try {
    const json = await csrfResponse.json();
    csrfToken = json.data?.token ?? '';
    csrfHeader = json.data?.headerName ?? 'X-XSRF-TOKEN';
  } catch {
    csrfToken = '';
  }

  const response = await fetchOAuthRedirect(href, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(csrfToken ? { [csrfHeader]: csrfToken } : {}),
    },
  });

  const location = response.headers.get('Location');
  if (location && isRedirectStatus(response.status)) {
    window.location.href = location;
    return;
  }

  if (response.type === 'opaqueredirect' || response.status === 0) {
    throw new ApiError('Failed to start provider link');
  }

  if (!response.ok) {
    try {
      const json = await response.json();
      throw new ApiError(json.message ?? json.error?.message ?? 'Failed to start provider link');
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(`Failed to start provider link: ${response.status}`);
    }
  }

  throw new ApiError('Failed to start provider link');
}
