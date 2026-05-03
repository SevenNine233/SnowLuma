import { useState, useMemo, useRef, useCallback } from 'react';
import { Avatar } from '@heroui/react';
import { Sun, Moon, Monitor, Eye, EyeOff, ArrowRight, KeyRound } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';

interface LoginPageProps {
  onLogin: (password: string) => Promise<{ success: boolean; error?: string }>;
}

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'system', icon: Monitor, label: '跟随系统' },
  { mode: 'light', icon: Sun, label: '浅色' },
  { mode: 'dark', icon: Moon, label: '深色' },
];

const SPARKLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: (i * 31 + 9) % 100,
  y: (i * 47 + 13) % 100,
  size: 2 + (i % 2),
  delay: (i * 0.35) % 4,
  duration: 3.5 + (i % 3),
}));

const BRAND_TAGS = ['OneBot v11', '多账号', '实时面板'];

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const { mode, resolved, setMode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const logoSrc = useMemo(() => '/logo.png', []);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 60, damping: 20 });

  const shellRotateX = useTransform(smoothY, [-0.5, 0.5], [4, -4]);
  const shellRotateY = useTransform(smoothX, [-0.5, 0.5], [-5, 5]);

  const orb1X = useTransform(smoothX, [-0.5, 0.5], [-45, 45]);
  const orb1Y = useTransform(smoothY, [-0.5, 0.5], [-28, 28]);
  const orb2X = useTransform(smoothX, [-0.5, 0.5], [35, -35]);
  const orb2Y = useTransform(smoothY, [-0.5, 0.5], [30, -30]);
  const accentX = useTransform(smoothX, [-0.5, 0.5], [-16, 16]);
  const accentY = useTransform(smoothY, [-0.5, 0.5], [-12, 12]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await onLogin(password);
    setLoading(false);
    if (!result.success && result.error) {
      setError(result.error);
      setShakeKey(k => k + 1);
    }
  };

  const darkMode = resolved === 'dark';

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'var(--bg-body)' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: darkMode
            ? 'linear-gradient(135deg, rgba(8,11,18,1) 0%, rgba(10,16,27,1) 42%, rgba(7,10,17,1) 100%)'
            : 'linear-gradient(135deg, #f8fbff 0%, #eef6ff 45%, #f9fafc 100%)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SPARKLES.map(s => (
          <motion.div
            key={s.id}
            className="absolute rounded-full"
            style={{
              width: s.size,
              height: s.size,
              left: `${s.x}%`,
              top: `${s.y}%`,
              background: darkMode
                ? `rgba(${s.id % 2 === 0 ? '56,189,248' : '129,140,248'},0.38)`
                : `rgba(${s.id % 2 === 0 ? '14,165,233' : '99,102,241'},0.26)`,
            }}
            animate={{ y: [0, -16, 0], opacity: [0.18, 0.55, 0.18], scale: [1, 1.25, 1] }}
            transition={{ duration: s.duration, delay: s.delay, ease: 'easeInOut', repeat: Infinity }}
          />
        ))}

        <motion.div
          className="absolute -left-24 -top-24 h-120 w-120 rounded-full"
          style={{
            x: orb1X,
            y: orb1Y,
            background: darkMode
              ? 'radial-gradient(circle, rgba(56,189,248,0.16) 0%, transparent 68%)'
              : 'radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 70%)',
            filter: 'blur(42px)',
          }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="absolute -right-16 -bottom-32 h-112 w-md rounded-full"
          style={{
            x: orb2X,
            y: orb2Y,
            background: darkMode
              ? 'radial-gradient(circle, rgba(129,140,248,0.14) 0%, transparent 68%)'
              : 'radial-gradient(circle, rgba(129,140,248,0.16) 0%, transparent 70%)',
            filter: 'blur(52px)',
          }}
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity, delay: 0.8 }}
        />
      </div>



      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ rotateX: shellRotateX, rotateY: shellRotateY, transformPerspective: 1200 }}
          className="relative w-full max-w-6xl"
        >
          <div
            className="absolute -inset-5 -z-10 rounded-4xl blur-3xl"
            style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(129,140,248,0.14), rgba(34,211,238,0.08))' }}
          />

          <div
            className="relative overflow-hidden rounded-4xl border"
            style={{
              background: darkMode
                ? 'linear-gradient(135deg, rgba(8,13,22,0.78), rgba(14,20,32,0.88))'
                : 'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.9))',
              borderColor: 'var(--glass-border)',
              backdropFilter: 'blur(38px) saturate(1.35)',
              WebkitBackdropFilter: 'blur(38px) saturate(1.35)',
              boxShadow: darkMode
                ? '0 38px 120px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)'
                : '0 32px 90px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: darkMode
                  ? 'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)'
                  : 'linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px)',
                backgroundSize: '36px 36px',
                maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent 82%)',
              }}
            />

            <motion.div
              className="pointer-events-none absolute right-[18%] top-[14%] h-28 w-28 rounded-full"
              style={{
                x: accentX,
                y: accentY,
                background: 'radial-gradient(circle, rgba(56,189,248,0.28), transparent 68%)',
                filter: 'blur(18px)',
              }}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
            />

            <div className="relative grid min-h-168 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="relative flex flex-col justify-center gap-12 p-6 sm:p-10 lg:p-14 xl:p-16">
                <div className="max-w-2xl">
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 }}
                    className="flex items-center gap-4"
                  >
                    <motion.div whileHover={{ scale: 1.03 }} className="relative shrink-0">
                      <div
                        className="absolute -inset-2 rounded-full blur-xl"
                        style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(129,140,248,0.22))' }}
                      />
                      <div
                        className="relative rounded-full border p-1"
                        style={{
                          borderColor: 'var(--glass-border)',
                          background: darkMode ? 'rgba(8,12,19,0.7)' : 'rgba(255,255,255,0.8)',
                        }}
                      >
                        <Avatar
                          className="size-16 rounded-full"
                          style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
                        >
                          <Avatar.Image src={logoSrc} alt="SnowLuma" className="object-cover" />
                          <Avatar.Fallback>SL</Avatar.Fallback>
                        </Avatar>
                      </div>
                    </motion.div>

                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                        SnowLuma 控制台
                      </div>
                      <h1
                        className="mt-1 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        SnowLuma
                      </h1>
                    </div>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.16 }}
                    className="mt-8 max-w-xl text-base leading-8"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    基于 OneBot v11 标准实现的高性能 QQ 协议网关。
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.22 }}
                    className="mt-8 flex flex-wrap gap-2"
                  >
                    {BRAND_TAGS.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full px-3.5 py-1.5 text-xs font-medium"
                        style={{
                          color: 'var(--accent)',
                          background: 'var(--accent-subtle)',
                          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                </div>

                <div className="absolute bottom-6 left-6 sm:bottom-10 sm:left-10 lg:bottom-14 lg:left-14 xl:bottom-16 xl:left-16 pointer-events-none">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="text-[11px] tracking-wide"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    &copy; {new Date().getFullYear()} SnowLuma. All rights reserved.
                  </motion.p>
                </div>
              </div>

              <div
                className="relative flex items-center px-5 pb-5 pt-0 sm:px-8 sm:pb-8 lg:border-l lg:px-12 lg:py-12"
                style={{ borderColor: 'var(--glass-border)' }}
              >
                <motion.div
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.18 }}
                  className="relative w-full max-w-md mx-auto rounded-[1.75rem] p-7 sm:p-8 overflow-hidden"
                  style={{
                    background: darkMode ? 'rgba(8,12,19,0.4)' : 'rgba(255,255,255,0.4)',
                    backdropFilter: 'blur(32px) saturate(1.2)',
                    WebkitBackdropFilter: 'blur(32px) saturate(1.2)',
                    boxShadow: darkMode
                      ? '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.08)'
                      : '0 24px 54px rgba(15,23,42,0.06), inset 0 1px 1px rgba(255,255,255,0.6)',
                    border: '1px solid',
                    borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                  }}
                >
                  {/* Subtle animated background glow for the card */}
                  <motion.div
                    className="absolute -top-32 -right-32 w-64 h-64 rounded-full pointer-events-none z-0"
                    style={{
                      background: 'var(--accent)',
                      opacity: 0.15,
                      filter: 'blur(60px)'
                    }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                        安全登录
                      </div>
                      {/* <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--text-primary)' }}>
                        验证访问令牌
                      </h2> */}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {THEME_OPTIONS.map(({ mode: m, icon: Icon, label }) => {
                        const active = mode === m;
                        return (
                          <button
                            key={m}
                            title={label}
                            onClick={() => setMode(m)}
                            className="relative flex size-8 cursor-pointer items-center justify-center rounded-xl transition-colors duration-200"
                            style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }}
                          >
                            {active && (
                              <motion.div
                                layoutId="theme-pill"
                                className="absolute inset-0 rounded-xl"
                                style={{ background: 'var(--accent-subtle)' }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <Icon size={14} className="relative z-10" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <motion.form
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.26 }}
                    onSubmit={handleSubmit}
                    className="relative z-10 mt-6 flex flex-col gap-5"
                  >
                    <motion.div
                      key={shakeKey}
                      className="relative flex items-center justify-between overflow-hidden rounded-2xl"
                      style={{
                        background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                        border: '1px solid',
                        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                        transition: 'all 0.3s ease',
                      }}
                      whileFocus={{ borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent-subtle)' }}
                      animate={shakeKey > 0 ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
                      transition={{ duration: 0.45, ease: 'easeInOut' }}
                    >
                      <div className="flex h-14 flex-1 items-center px-4">
                        <div
                          className="mr-3 shrink-0"
                          style={{ color: 'var(--text-tertiary)', transition: 'color 0.3s' }}
                        >
                          <KeyRound size={16} />
                        </div>
                        <input
                          type={showPwd ? 'text' : 'password'}
                          placeholder="输入访问令牌"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          autoFocus
                          className="h-full w-full bg-transparent text-sm font-medium outline-none placeholder:font-normal"
                          style={{
                            color: 'var(--text-primary)',
                          }}
                          onFocus={e => {
                            const icon = e.target.previousElementSibling as HTMLElement;
                            if (icon) icon.style.color = 'var(--accent)';
                          }}
                          onBlur={e => {
                            const icon = e.target.previousElementSibling as HTMLElement;
                            if (icon) icon.style.color = 'var(--text-tertiary)';
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPwd(v => !v)}
                        className="flex h-14 w-12 shrink-0 cursor-pointer items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </motion.div>

                    <AnimatePresence>
                      {error && (
                        <motion.p
                          key="err"
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.2 }}
                          className="rounded-2xl px-4 py-3 text-center text-xs"
                          style={{
                            color: 'var(--color-danger)',
                            background: 'rgba(248,113,113,0.08)',
                            border: '1px solid rgba(248,113,113,0.18)',
                          }}
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <motion.button
                      whileHover={{ scale: 1.015, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                      whileTap={{ scale: 0.985 }}
                      type="submit"
                      disabled={loading}
                      className="relative mt-2 flex h-13 cursor-pointer items-center justify-center overflow-hidden rounded-2xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-75"
                      style={{
                        background: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        color: 'var(--text-primary)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">
                        {loading ? (
                          <>
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
                              className="inline-block size-4 rounded-full border-2 border-t-transparent"
                              style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
                            />
                            验证中…
                          </>
                        ) : (
                          <>
                            进入控制台
                            <ArrowRight size={16} strokeWidth={2} />
                          </>
                        )}
                      </span>
                    </motion.button>
                  </motion.form>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

