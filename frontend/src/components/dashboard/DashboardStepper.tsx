import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface DashboardStep {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
}

interface DashboardStepperProps {
  steps: DashboardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  children: ReactNode;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export function DashboardStepper({
  steps,
  currentStep,
  onStepChange,
  children,
}: DashboardStepperProps) {
  const [direction, setDirection] = useState(0);
  const step = steps[currentStep];

  function goTo(next: number) {
    setDirection(next > currentStep ? 1 : -1);
    onStepChange(next);
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-glow">
              {step.icon}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-accent/80">
                Step {currentStep + 1} of {steps.length}
              </p>
              <h2 className="font-display text-xl font-bold text-white">{step.label}</h2>
              <p className="text-sm text-slate-500">{step.description}</p>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 sm:flex">
            {steps.map((s, index) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Go to ${s.label}`}
                className={`step-dot ${index === currentStep ? 'step-dot-active' : index < currentStep ? 'bg-accent/50' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-border/60">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-muted to-accent-glow"
            initial={false}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => goTo(currentStep - 1)}
          disabled={currentStep === 0}
          className="btn-ghost flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex gap-1 sm:hidden">
          {steps.map((s, index) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(index)}
              className={`step-dot ${index === currentStep ? 'step-dot-active' : ''}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(currentStep + 1)}
          disabled={currentStep === steps.length - 1}
          className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}