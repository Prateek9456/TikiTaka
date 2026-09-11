import { motion } from 'framer-motion';

interface TikiTakaLogoProps {
  size?: number;
  showWordmark?: boolean;
  animated?: boolean;
  className?: string;
}

function LogoMark({ animated }: { animated: boolean }) {
  const lineTransition = animated
    ? { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }
    : undefined;
  const nodeTransition = animated
    ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }
    : undefined;

  const lines = [
    { x1: 24, y1: 10, x2: 24, y2: 26, opacity: 0.5 },
    { x1: 24, y1: 10, x2: 10, y2: 22, opacity: 0.5 },
    { x1: 24, y1: 10, x2: 38, y2: 22, opacity: 0.5 },
    { x1: 10, y1: 22, x2: 24, y2: 26, opacity: 0.5 },
    { x1: 38, y1: 22, x2: 24, y2: 26, opacity: 0.5 },
    { x1: 10, y1: 22, x2: 16, y2: 36, opacity: 0.35 },
    { x1: 38, y1: 22, x2: 32, y2: 36, opacity: 0.35 },
    { x1: 16, y1: 36, x2: 24, y2: 26, opacity: 0.35 },
    { x1: 32, y1: 36, x2: 24, y2: 26, opacity: 0.35 },
    { x1: 16, y1: 36, x2: 32, y2: 36, opacity: 0.25 },
  ];

  const nodes = [
    { cx: 24, cy: 10, r: 2.8, fill: 'rgb(var(--accent-glow))' },
    { cx: 10, cy: 22, r: 2.8, fill: 'rgb(var(--accent-glow))' },
    { cx: 38, cy: 22, r: 2.8, fill: 'rgb(var(--accent-glow))' },
    { cx: 16, cy: 36, r: 2.4, fill: 'rgb(var(--accent))', opacity: 0.8 },
    { cx: 32, cy: 36, r: 2.4, fill: 'rgb(var(--accent))', opacity: 0.8 },
    { cx: 24, cy: 26, r: 2.2, fill: 'rgb(var(--accent-glow))', opacity: 0.9 },
  ];

  return (
    <>
      <defs>
        <linearGradient id="tk-logo-grad" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="rgb(var(--accent-glow))" />
          <stop offset="100%" stopColor="rgb(var(--accent))" />
        </linearGradient>
        <filter id="tk-logo-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="48" height="48" rx="12" fill="#0a0c10" />
      <rect width="48" height="48" rx="12" fill="url(#tk-logo-grad)" fillOpacity="0.08" />

      {lines.map((line, index) => (
        <motion.line
          key={index}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgb(var(--accent-glow))"
          strokeWidth="1.2"
          strokeOpacity={line.opacity}
          initial={animated ? { opacity: 0 } : undefined}
          animate={animated ? { opacity: line.opacity } : undefined}
          transition={animated ? { ...lineTransition, delay: index * 0.05 } : undefined}
        />
      ))}

      {nodes.map((node, index) => (
        <motion.circle
          key={index}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          fill={node.fill}
          fillOpacity={node.opacity ?? 1}
          initial={animated ? { scale: 0, opacity: 0 } : undefined}
          animate={animated ? { scale: 1, opacity: node.opacity ?? 1 } : undefined}
          transition={animated ? { ...nodeTransition, delay: 0.1 + index * 0.06 } : undefined}
        />
      ))}

      <motion.circle
        cx="17"
        cy="18"
        r="2.5"
        fill="#ffffff"
        filter="url(#tk-logo-glow)"
        initial={animated ? { scale: 0 } : undefined}
        animate={animated ? { scale: 1 } : undefined}
        transition={animated ? { delay: 0.6, duration: 0.3 } : undefined}
      />
    </>
  );
}

export function TikiTakaLogo({
  size = 48,
  showWordmark = false,
  animated = false,
  className = '',
}: TikiTakaLogoProps) {
  const Wrapper = animated ? motion.svg : 'svg';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <Wrapper
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        {...(animated
          ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4 } }
          : {})}
      >
        <LogoMark animated={animated} />
      </Wrapper>

      {showWordmark ? (
        <div className="flex flex-col">
          <span className="font-display text-lg font-bold leading-none tracking-tight text-white">
            Tiki<span className="text-accent-glow">Taka</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            AI
          </span>
        </div>
      ) : null}
    </div>
  );
}
