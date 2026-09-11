import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { TikiTakaLogo } from '../brand/TikiTakaLogo';
import { TikiTakaPassingAnimation } from './TikiTakaPassingAnimation';

const INTRO_SEEN_KEY = 'tikitaka_intro_seen';
const MIN_INTRO_MS = 3200;

interface AuthIntroSplashProps {
  onComplete: () => void;
}

export function hasSeenAuthIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAuthIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // ignore
  }
}

export function AuthIntroSplash({ onComplete }: AuthIntroSplashProps) {
  const [phase, setPhase] = useState<'playing' | 'logo' | 'exit'>('playing');
  const [cycles, setCycles] = useState(0);

  const finish = useCallback(() => {
    markAuthIntroSeen();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('logo'), MIN_INTRO_MS - 800);
    const exitTimer = window.setTimeout(() => setPhase('exit'), MIN_INTRO_MS);
    const doneTimer = window.setTimeout(finish, MIN_INTRO_MS + 600);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [finish]);

  const handleCycleComplete = useCallback(() => {
    setCycles((count) => count + 1);
    if (cycles >= 1 && phase === 'playing') {
      setPhase('logo');
    }
  }, [cycles, phase]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-accent-dim/30 via-surface to-surface" />

      <div className="relative flex w-full max-w-2xl flex-col items-center px-6">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <TikiTakaPassingAnimation
            variant="intro"
            className="h-auto w-full drop-shadow-[0_0_40px_rgba(16,185,129,0.15)]"
            onCycleComplete={handleCycleComplete}
          />
        </motion.div>

        <AnimatePresence>
          {phase !== 'playing' ? (
            <motion.div
              className="mt-10 flex flex-col items-center"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <TikiTakaLogo size={64} showWordmark animated />
              <motion.p
                className="mt-4 text-sm text-slate-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Tactical intelligence, one pass at a time
              </motion.p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
