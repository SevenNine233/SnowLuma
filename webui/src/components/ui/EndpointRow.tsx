import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

interface EndpointRowProps {
  onRemove: () => void;
  children: ReactNode;
}

export function EndpointRow({ onRemove, children }: EndpointRowProps) {
  return (
    <div
      className="flex items-end gap-3 px-5 py-4"
      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'var(--transition-fast)' }}
    >
      {children}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onRemove}
        className="size-7 shrink-0 flex items-center justify-center rounded-lg cursor-pointer mb-0.5"
        style={{ color: 'var(--text-tertiary)', transition: 'var(--transition-fast)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <X size={14} />
      </motion.button>
    </div>
  );
}
