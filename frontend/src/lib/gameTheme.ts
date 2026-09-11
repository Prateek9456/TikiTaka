export interface GameTheme {
  slug: string;
  label: string;
  shortLabel: string;
  tagline: string;
}

export const GAME_THEMES: Record<string, GameTheme> = {
  cs2: {
    slug: 'cs2',
    label: 'Counter-Strike 2',
    shortLabel: 'CS2',
    tagline: 'Tactical round intelligence',
  },
  dota2: {
    slug: 'dota2',
    label: 'Dota 2',
    shortLabel: 'DOTA',
    tagline: 'Draft-to-fight pattern engine',
  },
  lol: {
    slug: 'lol',
    label: 'League of Legends',
    shortLabel: 'LOL',
    tagline: 'Macro and fight sequences',
  },
  valorant: {
    slug: 'valorant',
    label: 'Valorant',
    shortLabel: 'VAL',
    tagline: 'Site-hit and retake analysis',
  },
};

export function getGameTheme(slug: string | undefined | null): GameTheme {
  if (slug && GAME_THEMES[slug]) {
    return GAME_THEMES[slug];
  }
  return {
    slug: 'default',
    label: 'TikiTaka',
    shortLabel: 'TT',
    tagline: 'Esports tactical analytics',
  };
}

export function applyGameTheme(slug: string | undefined | null) {
  document.documentElement.dataset.game = getGameTheme(slug).slug;
}

export function themeRgb(token: string, fallback = '#ffc420'): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return raw ? `rgb(${raw})` : fallback;
}
