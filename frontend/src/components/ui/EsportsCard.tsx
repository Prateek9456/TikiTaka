import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface EsportsCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function EsportsCard({ children, className = '', delay = 0 }: EsportsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={`esports-card ${className}`}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
