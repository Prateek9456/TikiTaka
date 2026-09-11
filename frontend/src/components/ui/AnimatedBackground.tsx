import { motion } from 'framer-motion';
import { TikiTakaPassingAnimation } from '../animations/TikiTakaPassingAnimation';

interface AnimatedBackgroundProps {
  variant?: 'auth' | 'app';
}

export function AnimatedBackground({ variant = 'auth' }: AnimatedBackgroundProps) {
  const isAuth = variant === 'auth';

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-50" />
      <div className="absolute inset-0 bg-hex bg-hex opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface to-accent-dim/30" />
      <div className="scanlines absolute inset-0 opacity-40" />

      <div className={`absolute inset-0 flex items-center justify-center ${isAuth ? 'opacity-80' : 'opacity-25'}`}>
        <TikiTakaPassingAnimation
          variant="ambient"
          className="h-full w-full max-h-[90vh] max-w-[92vw] translate-y-10"
        />
      </div>

      <motion.div
        className="absolute -left-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-3xl"
        animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-chart-violet/10 blur-3xl"
        animate={{ x: [0, -40, 0], y: [0, 50, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/40 to-transparent"
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </div>
  );
}
