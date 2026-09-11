import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { AuthIntroSplash, hasSeenAuthIntro } from '../animations/AuthIntroSplash';
import { TikiTakaLogo } from '../brand/TikiTakaLogo';
import { AnimatedBackground } from '../ui/AnimatedBackground';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const [showIntro, setShowIntro] = useState(() => !hasSeenAuthIntro());

  return (
    <>
      <AnimatePresence>{showIntro ? <AuthIntroSplash onComplete={() => setShowIntro(false)} /> : null}</AnimatePresence>

      <div
        className={`relative min-h-screen transition-opacity duration-500 ${showIntro ? 'opacity-0' : 'opacity-100'}`}
      >
        <AnimatedBackground variant="auth" />

        <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: showIntro ? 0 : 1, x: showIntro ? -24 : 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <TikiTakaLogo size={72} showWordmark animated={!showIntro} />
            <h2 className="mt-8 font-display text-5xl font-black leading-tight text-white">
              Command your
              <span className="block text-accent">next fight.</span>
            </h2>
            <p className="mt-4 max-w-md text-lg text-ink-muted">
              TikiTaka match intelligence with Markov patterns, live session heat, and XGBoost scoring.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {['Live ladder', 'Pattern radar', 'Session heat'].map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.08 }}
                  className="esports-card p-4"
                >
                  <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent">{item}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: showIntro ? 0 : 1, y: showIntro ? 24 : 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-md"
          >
            <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="mb-5 lg:hidden">
                <TikiTakaLogo size={56} animated={!showIntro} />
              </div>
              <p className="label-kicker">TikiTaka AI</p>
              <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-white">{title}</h1>
              <p className="mt-2 max-w-sm text-sm text-ink-muted">{subtitle}</p>
            </div>

            <div className="esports-card border-accent/20 p-8">{children}</div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
