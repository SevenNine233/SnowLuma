import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

interface SectionCardProps {
  title: string;
  onAdd: () => void;
  children: ReactNode;
}

export function SectionCard({ title, onAdd, children }: SectionCardProps) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: dark ? 'rgba(8,12,19,0.4)' : 'rgba(255,255,255,0.4)',
        border: '1px solid',
        borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(32px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(32px) saturate(1.2)',
        boxShadow: dark
          ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.06)'
          : '0 8px 24px rgba(15,23,42,0.04), inset 0 1px 1px rgba(255,255,255,0.5)',
        transition: 'var(--transition-base)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onAdd}
          className="size-7 flex items-center justify-center rounded-lg cursor-pointer"
          style={{ color: 'var(--text-secondary)', transition: 'var(--transition-fast)' }}
        >
          <Plus size={14} />
        </motion.button>
      </div>

      {/* Body */}
      <div>
        {!children ? (
          <p className="text-xs px-5 py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>未配置，点击 + 新增</p>
        ) : children}
      </div>
    </div>
  );
}
