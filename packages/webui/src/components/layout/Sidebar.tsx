import { LayoutDashboard, Settings, LogOut, Sun, Moon, Monitor, Terminal } from 'lucide-react';
import { Avatar } from '@heroui/react';
import { StatusBadge } from '../ui/StatusBadge';
import { motion } from 'framer-motion';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';

type Page = '总览' | '配置' | '日志';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  status: string;
  onLogout: () => void;
}

const navItems: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: '总览', label: '总览', icon: LayoutDashboard },
  { page: '配置', label: '配置', icon: Settings },
  { page: '日志', label: '日志', icon: Terminal },
];

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'system', icon: Monitor, label: '跟随系统' },
  { mode: 'light', icon: Sun, label: '浅色' },
  { mode: 'dark', icon: Moon, label: '深色' },
];

export function Sidebar({ activePage, onNavigate, status, onLogout }: SidebarProps) {
  const { resolved, mode, setMode } = useTheme();
  const dark = resolved === 'dark';

  return (
    <aside
      className="w-55 shrink-0 flex flex-col z-40 m-3 rounded-2xl overflow-hidden relative"
      style={{
        background: dark
          ? 'linear-gradient(135deg, rgba(8,13,22,0.78), rgba(14,20,32,0.88))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.9))',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(38px) saturate(1.35)',
        WebkitBackdropFilter: 'blur(38px) saturate(1.35)',
        boxShadow: dark
          ? '0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 20px 60px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
      }}
    >
      {/* Top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/8 to-transparent" />

      {/* Grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: dark
            ? 'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)'
            : 'linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.3), transparent 70%)',
        }}
      />

      {/* Accent glow at top-left */}
      <motion.div
        className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(56,189,248,0.2), transparent 68%)',
          filter: 'blur(14px)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Logo */}
      <div className="relative h-16 px-5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="relative shrink-0">
          <div
            className="absolute -inset-1.5 rounded-full blur-lg"
            style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(129,140,248,0.18))' }}
          />
          <div
            className="relative rounded-full border p-0.5"
            style={{
              borderColor: 'var(--glass-border)',
              background: dark ? 'rgba(8,12,19,0.7)' : 'rgba(255,255,255,0.8)',
            }}
          >
            <Avatar
              className="rounded-full"
              style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
            >
              <Avatar.Image src="/logo.png" alt="SnowLuma" className="object-cover" />
              <Avatar.Fallback>SL</Avatar.Fallback>
            </Avatar>
          </div>
        </div>
        <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          SnowLuma
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 flex flex-col gap-1.5">
        {navItems.map(({ page, label, icon: Icon }) => {
          const isActive = activePage === page;
          return (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              key={page}
              onClick={() => onNavigate(page)}
              className="flex items-center gap-2.5 h-9 px-3 rounded-xl text-sm font-medium cursor-pointer relative overflow-hidden"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = 'var(--bg-hover)'); }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = 'transparent'); }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarActive"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'var(--accent-subtle)',
                    border: '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                size={16}
                strokeWidth={isActive ? 2.2 : 1.8}
                className="relative z-10 shrink-0"
                style={{ color: isActive ? 'var(--accent)' : undefined }}
              />
              <span className="relative z-10">{label}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="relative p-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-1">
          <StatusBadge status={status} />
          <div className="flex items-center gap-0.5">
            {THEME_OPTIONS.map(({ mode: m, icon: Icon, label }) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  title={label}
                  onClick={() => setMode(m)}
                  className="relative flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200"
                  style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-theme-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'var(--accent-subtle)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={13} className="relative z-10" />
                </button>
              );
            })}
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLogout}
          className="flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-medium cursor-pointer"
          style={{
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-subtle)',
            transition: 'var(--transition-fast)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'; e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={13} strokeWidth={2} />
          登出
        </motion.button>
      </div>
    </aside>
  );
}
