import { motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string;
  title?: string;
  onDismiss: () => void;
}

export function Toast({ message, title = 'Insights ready', onDismiss }: ToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-accent/40 bg-surface-raised px-4 py-3 shadow-glow"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-glow" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg p-1 text-slate-500 transition hover:bg-surface-elevated hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
