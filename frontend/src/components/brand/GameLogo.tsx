interface GameLogoProps {
  slug?: string | null;
  size?: number;
  className?: string;
}

const GAME_LOGOS: Record<string, string> = {
  cs2: '/logos/cs2.svg',
  dota2: '/logos/dota2.svg',
  lol: '/logos/lol.svg',
  valorant: '/logos/valorant.svg',
};

export function GameLogo({ slug, size = 40, className = '' }: GameLogoProps) {
  const src = slug ? GAME_LOGOS[slug] : undefined;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#12161f" />
      <circle cx="16" cy="30" r="4" fill="rgb(var(--accent))" />
      <circle cx="32" cy="30" r="4" fill="rgb(var(--accent))" />
      <circle cx="24" cy="16" r="4" fill="rgb(var(--accent-glow))" />
      <path d="M16 30 24 16 32 30" stroke="rgb(var(--accent))" strokeWidth="2" fill="none" />
    </svg>
  );
}
