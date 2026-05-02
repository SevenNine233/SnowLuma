import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: 'default' | 'success' | 'warning' | 'danger';
}

const accentColors: Record<string, { icon: string; value: string; glow: string }> = {
  default: { icon: 'var(--accent)', value: 'var(--text-primary)', glow: 'var(--accent-glow)' },
  success: { icon: 'var(--color-success)', value: 'var(--color-success)', glow: 'rgba(52,211,153,0.1)' },
  warning: { icon: 'var(--color-warning)', value: 'var(--color-warning)', glow: 'rgba(251,191,36,0.1)' },
  danger: { icon: 'var(--color-danger)', value: 'var(--color-danger)', glow: 'rgba(248,113,113,0.1)' },
};

export function StatCard({ label, value, icon, accent = 'default' }: StatCardProps) {
  const colors = accentColors[accent];
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-xl p-5 group overflow-hidden"
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
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        {icon && (
          <div
            className="size-8 rounded-lg flex items-center justify-center"
            style={{ background: colors.glow, color: colors.icon }}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        className="text-2xl font-bold tracking-tight"
        style={{ color: colors.value, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
    </motion.div>
  );
}
