import { Users, Activity, Cpu, RefreshCw, Loader2, CheckCircle2, AlertCircle, Unplug } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatCard } from '../ui/StatCard';
import { useTheme } from '../../contexts/ThemeContext';
import type { QQInfo, HookProcessInfo } from '../../types';

interface OverviewPageProps {
  qqList: QQInfo[];
  status: string;
  processList: HookProcessInfo[];
  processLoadingPid: number | null;
  processUnloadingPid: number | null;
  processActionStatus: string;
  onRefreshProcesses: () => void;
  onLoadProcess: (pid: number) => void;
  onUnloadProcess: (pid: number) => void;
}

const processStatusLabel: Record<HookProcessInfo['status'], string> = {
  available: '可加载',
  loading: '加载中',
  loaded: '等待登录',
  online: '已在线',
  error: '错误',
  disconnected: '已断开',
};

function processStatusColor(status: HookProcessInfo['status']): string {
  if (status === 'online') return 'var(--color-success)';
  if (status === 'error' || status === 'disconnected') return 'var(--color-danger)';
  if (status === 'loading' || status === 'loaded') return 'var(--accent)';
  return 'var(--text-secondary)';
}

function qqAvatarUrl(uin: string): string {
  return `/avatar/${encodeURIComponent(uin)}`;
}

export function OverviewPage({
  qqList,
  status,
  processList,
  processLoadingPid,
  processUnloadingPid,
  processActionStatus,
  onRefreshProcesses,
  onLoadProcess,
  onUnloadProcess,
}: OverviewPageProps) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="接入账号"
          value={String(qqList.length)}
          icon={<Users size={18} strokeWidth={2} />}
        />
        <StatCard
          label="服务状态"
          value={status === '已连接' ? '运行中' : status}
          icon={<Activity size={18} strokeWidth={2} />}
          accent={status === '已连接' ? 'success' : 'danger'}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="rounded-xl p-4"
        style={{
          background: dark ? 'rgba(8,12,19,0.4)' : 'rgba(255,255,255,0.4)',
          border: '1px solid',
          borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(32px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.2)',
          boxShadow: dark
            ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.06)'
            : '0 8px 24px rgba(15,23,42,0.04), inset 0 1px 1px rgba(255,255,255,0.5)',
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div
              className="size-9 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
            >
              <Cpu size={17} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                选择 QQ 进程
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                加载 SnowLuma 后会监听登录状态，登录成功后自动接入原有 OneBot 流程
              </p>
            </div>
          </div>
          <button
            onClick={onRefreshProcesses}
            className="h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
            }}
          >
            <RefreshCw size={13} />
            刷新
          </button>
        </div>

        {processActionStatus && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-xs"
            style={{
              color: 'var(--accent)',
              background: 'var(--accent-subtle)',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
            }}
          >
            {processActionStatus}
          </div>
        )}

        {processList.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {processList.map((proc, idx) => {
              const loading = processLoadingPid === proc.pid || proc.status === 'loading';
              const unloading = processUnloadingPid === proc.pid;
              const busy = loading || unloading;
              const online = proc.status === 'online';
              const canUnload = proc.injected || proc.status === 'loaded' || online || proc.status === 'disconnected';
              const disabled = busy;
              const actionLabel = canUnload
                ? unloading ? '卸载中' : '卸载'
                : loading ? '加载中' : '加载';
              const action = canUnload ? () => onUnloadProcess(proc.pid) : () => onLoadProcess(proc.pid);
              return (
                <motion.div
                  key={proc.pid}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + idx * 0.03, duration: 0.22 }}
                  className="flex items-center gap-3 rounded-xl p-3 overflow-hidden"
                  style={{
                    background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.46)',
                    border: '1px solid',
                    borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    className="size-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                  >
                    {online ? <CheckCircle2 size={18} /> : proc.status === 'error' ? <AlertCircle size={18} /> : <Cpu size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {proc.name || 'QQ.exe'}
                      </span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded-md shrink-0"
                        style={{
                          color: processStatusColor(proc.status),
                          background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {processStatusLabel[proc.status]}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      PID {proc.pid}{proc.uin && proc.uin !== '0' ? ` · UIN ${proc.uin}` : ''}
                    </div>
                    {proc.path && (
                      <div className="text-[11px] mt-0.5 truncate" title={proc.path} style={{ color: 'var(--text-tertiary)' }}>
                        {proc.path}
                      </div>
                    )}
                    {proc.error && (
                      <div className="text-[11px] mt-1 truncate" title={proc.error} style={{ color: 'var(--color-danger)' }}>
                        {proc.error}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={action}
                    disabled={disabled}
                    className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                    style={{
                      color: disabled ? 'var(--text-tertiary)' : canUnload ? 'var(--color-danger)' : 'white',
                      background: disabled ? 'var(--bg-hover)' : canUnload ? 'rgba(248,113,113,0.08)' : 'linear-gradient(135deg, var(--accent), #818cf8)',
                      cursor: disabled ? 'default' : 'pointer',
                      border: canUnload ? '1px solid rgba(248,113,113,0.2)' : '1px solid transparent',
                      boxShadow: disabled || canUnload ? 'none' : '0 8px 18px var(--accent-glow)',
                    }}
                  >
                    {busy && <Loader2 size={13} className="animate-spin" />}
                    {!busy && canUnload && <Unplug size={13} />}
                    {actionLabel}
                  </button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-10 rounded-xl gap-2"
            style={{
              border: '1px dashed',
              borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <Cpu size={30} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>未检测到可加载 QQ 主进程</p>
          </div>
        )}
      </motion.div>

      {/* Account list */}
      {qqList.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            在线会话
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {qqList.map((q, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.04, duration: 0.25 }}
                whileHover={{ y: -2 }}
                key={q.uin}
                className="flex items-center gap-3 p-4 rounded-xl cursor-default group overflow-hidden"
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
                <div
                  className="size-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), #818cf8)',
                    boxShadow: '0 0 12px var(--accent-glow)',
                  }}
                >
                  <img
                    src={qqAvatarUrl(q.uin)}
                    alt={q.nickname || q.uin}
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {q.nickname}
                  </div>
                  <div
                    className="text-xs mt-0.5 truncate"
                    style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {q.uin}
                  </div>
                </div>
                <span
                  className="size-2 rounded-full shrink-0 animate-pulse"
                  style={{ background: 'var(--color-success)', boxShadow: '0 0 8px rgba(52,211,153,0.5)' }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {qqList.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 rounded-xl gap-3"
          style={{
            background: dark ? 'rgba(8,12,19,0.4)' : 'rgba(255,255,255,0.4)',
            border: '1px dashed',
            borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Users size={36} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>暂无在线会话</p>
        </motion.div>
      )}
    </div>
  );
}
