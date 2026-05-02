import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

interface LogEntry {
  id: number;
  time: string;
  level: 'debug' | 'info' | 'success' | 'warn' | 'error';
  scope: string;
  message: string;
  line: string;
}

interface LogsPageProps {
  fetchApi: (url: string, options?: RequestInit) => Promise<Response>;
}

const levelColor: Record<LogEntry['level'], string> = {
  debug: 'var(--text-tertiary)',
  info: 'var(--accent)',
  success: 'var(--color-success)',
  warn: '#f59e0b',
  error: 'var(--color-danger)',
};

export function LogsPage({ fetchApi }: LogsPageProps) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [streamStatus, setStreamStatus] = useState('连接中');
  const endRef = useRef<HTMLDivElement | null>(null);

  const token = useMemo(() => localStorage.getItem('snowluma_token') || '', []);

  async function loadLogs() {
    const res = await fetchApi('/api/logs?limit=500');
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data.list || []);
  }

  useEffect(() => {
    loadLogs().catch(console.error);
  }, []);

  useEffect(() => {
    if (!token) return;
    const url = `/api/logs/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);
    source.onopen = () => setStreamStatus('实时连接');
    source.onerror = () => setStreamStatus('重连中');
    source.onmessage = event => {
      try {
        const entry = JSON.parse(event.data) as LogEntry | { type: string };
        if ('type' in entry) return;
        setLogs(prev => [...prev.filter(item => item.id !== entry.id), entry].slice(-500));
      } catch {
      }
    };
    return () => source.close();
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [logs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4"
        style={{
          background: dark ? 'rgba(8,12,19,0.4)' : 'rgba(255,255,255,0.4)',
          border: '1px solid',
          borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(32px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.2)',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
            >
              <Terminal size={17} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>运行日志</h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{streamStatus} · 最近 {logs.length} 条</p>
            </div>
          </div>
          <button
            onClick={() => loadLogs().catch(console.error)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
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

        <div
          className="h-[58vh] overflow-auto rounded-xl p-3 text-xs"
          style={{
            background: dark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.42)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>暂无日志</div>
          ) : logs.map(log => (
            <div key={log.id} className="flex gap-2 whitespace-pre-wrap py-0.5 leading-5">
              <span className="shrink-0" style={{ color: 'var(--text-tertiary)' }}>{new Date(log.time).toLocaleTimeString()}</span>
              <span className="w-14 shrink-0 font-semibold" style={{ color: levelColor[log.level] }}>{log.level.toUpperCase()}</span>
              <span className="w-24 shrink-0 truncate" style={{ color: 'var(--text-secondary)' }}>[{log.scope}]</span>
              <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </motion.div>
    </div>
  );
}
