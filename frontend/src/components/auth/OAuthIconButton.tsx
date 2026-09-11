import { motion } from 'framer-motion';
import { OAUTH_PROVIDER_COLORS, PROVIDER_LABELS } from '../../lib/oauth';
import type { OAuthProvider } from '../../types/api';
import { OAuthProviderIcon } from './OAuthProviderIcon';

interface OAuthIconButtonProps {
  provider: OAuthProvider;
  disabled?: boolean;
  onClick: () => void;
  index?: number;
}

export function OAuthIconButton({ provider, disabled, onClick, index = 0 }: OAuthIconButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 + index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: disabled ? 1 : 1.08, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      title={PROVIDER_LABELS[provider]}
      aria-label={`Sign in with ${PROVIDER_LABELS[provider]}`}
      className={`group flex h-12 w-12 items-center justify-center rounded-xl border border-surface-border bg-surface-elevated/80 text-slate-300 backdrop-blur-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${OAUTH_PROVIDER_COLORS[provider]}`}
    >
      <OAuthProviderIcon provider={provider} className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
    </motion.button>
  );
}
