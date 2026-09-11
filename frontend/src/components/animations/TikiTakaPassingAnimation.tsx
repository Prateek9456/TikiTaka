import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import {
  TIKITAKA_EDGES,
  TIKITAKA_NODES,
  TIKITAKA_PASS_SEQUENCE,
  TIKITAKA_VIEWBOX,
} from '../../lib/tikitakaGeometry';

type AnimationVariant = 'intro' | 'ambient';

interface TikiTakaPassingAnimationProps {
  variant?: AnimationVariant;
  className?: string;
  onCycleComplete?: () => void;
}

const VARIANT_CONFIG = {
  intro: {
    lineOpacity: 0.55,
    nodeRadius: 5,
    hubRadius: 4,
    ballRadius: 6,
    stepDuration: 0.22,
    lineWidth: 1.5,
    glow: true,
    showPitch: true,
  },
  ambient: {
    lineOpacity: 0.12,
    nodeRadius: 3,
    hubRadius: 2.5,
    ballRadius: 3.5,
    stepDuration: 0.55,
    lineWidth: 1,
    glow: false,
    showPitch: false,
  },
} as const;

export function TikiTakaPassingAnimation({
  variant = 'ambient',
  className = '',
  onCycleComplete,
}: TikiTakaPassingAnimationProps) {
  const config = VARIANT_CONFIG[variant];
  const ballControls = useAnimationControls();

  const passPoints = useMemo(
    () => TIKITAKA_PASS_SEQUENCE.map((index) => TIKITAKA_NODES[index]),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function runPassingLoop() {
      for (let i = 0; i < passPoints.length; i++) {
        if (cancelled) return;
        const point = passPoints[i];
        await ballControls.start({
          cx: point.x,
          cy: point.y,
          transition: {
            duration: config.stepDuration,
            ease: [0.4, 0, 0.2, 1],
          },
        });
      }
      onCycleComplete?.();
      if (!cancelled) {
        void runPassingLoop();
      }
    }

    void runPassingLoop();

    return () => {
      cancelled = true;
    };
  }, [ballControls, config.stepDuration, onCycleComplete, passPoints]);

  const startPoint = passPoints[0];

  return (
    <svg
      viewBox={`0 0 ${TIKITAKA_VIEWBOX.width} ${TIKITAKA_VIEWBOX.height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`tk-ball-${variant}`} cx="40%" cy="40%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="rgb(var(--accent-glow))" />
          <stop offset="100%" stopColor="rgb(var(--accent))" />
        </radialGradient>
        {config.glow ? (
          <filter id={`tk-ball-glow-${variant}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
        <linearGradient id={`tk-line-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent-glow))" stopOpacity={config.lineOpacity} />
          <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={config.lineOpacity * 0.6} />
        </linearGradient>
      </defs>

      {config.showPitch ? (
        <g opacity={0.15}>
          <ellipse cx="200" cy="142" rx="160" ry="110" fill="none" stroke="rgb(var(--accent))" strokeWidth="1" />
          <line x1="200" y1="32" x2="200" y2="252" stroke="rgb(var(--accent))" strokeWidth="0.8" strokeDasharray="4 6" />
          <circle cx="200" cy="142" r="36" fill="none" stroke="rgb(var(--accent))" strokeWidth="0.8" />
        </g>
      ) : null}

      {TIKITAKA_EDGES.map(([from, to], index) => {
        const a = TIKITAKA_NODES[from];
        const b = TIKITAKA_NODES[to];
        return (
          <motion.line
            key={`${from}-${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={`url(#tk-line-${variant})`}
            strokeWidth={config.lineWidth}
            strokeLinecap="round"
            initial={variant === 'intro' ? { opacity: 0 } : { opacity: config.lineOpacity }}
            animate={
              variant === 'intro'
                ? { opacity: config.lineOpacity }
                : { opacity: [config.lineOpacity * 0.7, config.lineOpacity, config.lineOpacity * 0.7] }
            }
            transition={
              variant === 'intro'
                ? { delay: index * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }
                : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        );
      })}

      {TIKITAKA_NODES.map((node, index) => {
        const isHub = index === 5;
        const radius = isHub ? config.hubRadius : config.nodeRadius;
        return (
          <motion.circle
            key={index}
            cx={node.x}
            cy={node.y}
            r={radius}
            fill={isHub ? 'rgb(var(--accent-glow))' : 'rgb(var(--accent))'}
            fillOpacity={variant === 'ambient' ? 0.35 : isHub ? 0.9 : 0.75}
            initial={variant === 'intro' ? { scale: 0, opacity: 0 } : undefined}
            animate={
              variant === 'intro'
                ? { scale: 1, opacity: 1 }
                : { opacity: [0.25, 0.45, 0.25] }
            }
            transition={
              variant === 'intro'
                ? { delay: 0.1 + index * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                : { duration: 3 + index * 0.3, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        );
      })}

      <motion.circle
        cx={startPoint.x}
        cy={startPoint.y}
        r={config.ballRadius}
        fill={`url(#tk-ball-${variant})`}
        filter={config.glow ? `url(#tk-ball-glow-${variant})` : undefined}
        animate={ballControls}
        initial={{ cx: startPoint.x, cy: startPoint.y, scale: variant === 'intro' ? 0 : 1 }}
        style={{ originX: '50%', originY: '50%' }}
      />
    </svg>
  );
}
