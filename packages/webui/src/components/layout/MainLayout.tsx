import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, LayoutDashboard, Settings, Sparkles, Terminal } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useTheme } from '../../contexts/ThemeContext';

type Page = '总览' | '配置' | '日志';

interface MainLayoutProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  status: string;
  onLogout: () => void;
  children: ReactNode;
}

const pageMeta: Record<Page, { title: string; subtitle: string; badge: string; icon: typeof LayoutDashboard }> = {
  '总览': { title: '总览', subtitle: '查看当前接入的 QQ 账号及服务运行状态', badge: '控制台视图', icon: LayoutDashboard },
  '配置': { title: '节点配置', subtitle: '管理 OneBot 协议端点与通信参数', badge: '协议编排', icon: Settings },
  '日志': { title: '日志', subtitle: '查看后端运行日志与实时事件流', badge: 'SSE 实时流', icon: Terminal },
};

export function MainLayout({ activePage, onNavigate, status, onLogout, children }: MainLayoutProps) {
  const meta = pageMeta[activePage];
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const PageIcon = meta.icon;
  const runtimeLabel = status === '已连接' ? '运行中' : status;

  return (
    <div className="h-screen w-screen flex overflow-hidden font-(--font-sans)" style={{ background: 'var(--bg-body)' }}>
      {/* Full-screen ambient gradient — matches login page */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: dark
            ? 'linear-gradient(135deg, rgba(8,11,18,1) 0%, rgba(10,16,27,1) 42%, rgba(7,10,17,1) 100%)'
            : 'linear-gradient(135deg, #f8fbff 0%, #eef6ff 45%, #f9fafc 100%)',
        }}
      />

      {/* Animated orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-24 -top-24 h-[60vh] w-[60vh] rounded-full"
          style={{
            background: dark
              ? 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 68%)'
              : 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)',
            filter: 'blur(42px)',
          }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="absolute -right-16 -bottom-32 h-[50vh] w-[50vh] rounded-full"
          style={{
            background: dark
              ? 'radial-gradient(circle, rgba(129,140,248,0.10) 0%, transparent 68%)'
              : 'radial-gradient(circle, rgba(129,140,248,0.14) 0%, transparent 70%)',
            filter: 'blur(52px)',
          }}
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity, delay: 0.8 }}
        />
      </div>

      {/* Sidebar */}
      <Sidebar activePage={activePage} onNavigate={onNavigate} status={status} onLogout={onLogout} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 p-3 pl-0 z-10 relative">
        <main
          className="flex-1 overflow-y-auto rounded-2xl relative"
          style={{
            background: dark
              ? 'linear-gradient(135deg, rgba(8,13,22,0.72), rgba(14,20,32,0.82))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.68), rgba(255,255,255,0.85))',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(38px) saturate(1.35)',
            WebkitBackdropFilter: 'blur(38px) saturate(1.35)',
            boxShadow: dark
              ? '0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 20px 60px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
          }}
        >
          {/* Top highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/8 to-transparent rounded-t-2xl" />

          {/* Grid texture overlay */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              backgroundImage: dark
                ? 'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)'
                : 'linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
              maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.35), transparent 60%)',
            }}
          />

          {/* Accent glow in corner */}
          <motion.div
            className="pointer-events-none absolute right-[12%] top-[8%] h-32 w-32 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(56,189,248,0.18), transparent 68%)',
              filter: 'blur(20px)',
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
          />

          <div className="relative w-full min-h-full px-4 py-4 sm:px-6 sm:py-6 xl:px-8 2xl:px-10 flex flex-col">
            {/* Page header */}
            <AnimatePresence mode="wait">
              <motion.header
                key={meta.title + '_header'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}
                className="mb-6"
              >
                <div
                  className="relative overflow-hidden rounded-[1.75rem] border px-4 py-4 sm:px-5 sm:py-5 xl:px-6"
                  style={{
                    background: dark
                      ? 'linear-gradient(135deg, rgba(8,12,20,0.48), rgba(14,20,32,0.62))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.72))',
                    borderColor: 'var(--glass-border)',
                    boxShadow: dark
                      ? '0 18px 48px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.04)'
                      : '0 14px 40px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: dark
                        ? 'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)'
                        : 'linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px)',
                      backgroundSize: '34px 34px',
                      maskImage: 'linear-gradient(90deg, rgba(0,0,0,0.45), transparent 85%)',
                    }}
                  />

                  <motion.div
                    className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(56,189,248,0.16), transparent 68%)',
                      filter: 'blur(18px)',
                    }}
                    animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.78, 0.45] }}
                    transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
                  />

                  <div className="relative flex items-center justify-between gap-6">
                    <div className="flex min-w-0 items-center gap-4">
                      {/* Icon */}
                      <div
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
                        style={{
                          borderColor: 'color-mix(in srgb, var(--accent) 26%, transparent)',
                          background: dark
                            ? 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(129,140,248,0.14))'
                            : 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(129,140,248,0.12))',
                          boxShadow: '0 8px 22px color-mix(in srgb, var(--accent) 16%, transparent)',
                        }}
                      >
                        <PageIcon size={20} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
                      </div>

                      {/* Title block */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h1 className="text-xl font-bold tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>
                            {meta.title}
                          </h1>
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              color: 'var(--accent)',
                              background: 'var(--accent-subtle)',
                              border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                            }}
                          >
                            <Sparkles size={10} className="mr-1" />
                            {meta.badge}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {meta.subtitle}
                        </p>
                      </div>
                    </div>

                    <motion.div
                      whileHover={{ y: -1.5 }}
                      className="hidden sm:flex shrink-0 overflow-hidden rounded-2xl border px-4 py-3 items-center gap-3"
                      style={{
                        borderColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)',
                        background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.52)',
                        backdropFilter: 'blur(18px)',
                        WebkitBackdropFilter: 'blur(18px)',
                      }}
                    >
                      <Activity size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>运行状态</div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{runtimeLabel}</div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.header>
            </AnimatePresence>

            {/* Page content */}
            <div className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePage}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1"
                >
                  {children}
                </motion.div>
              </AnimatePresence>

              <motion.footer
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 }}
                className="mt-8 flex items-center justify-center border-t pt-5 text-[11px] tracking-wide"
                style={{
                  color: 'var(--text-tertiary)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                &copy; {new Date().getFullYear()} SnowLuma. All rights reserved.
              </motion.footer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
