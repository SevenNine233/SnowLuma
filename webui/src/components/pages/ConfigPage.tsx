import { MousePointerClick } from 'lucide-react';
import { motion } from 'framer-motion';
import { SectionCard } from '../ui/SectionCard';
import { EndpointRow } from '../ui/EndpointRow';
import { FieldInput } from '../ui/FieldInput';
import { useTheme } from '../../contexts/ThemeContext';
import type { QQInfo, OneBotConfig } from '../../types';

interface ConfigPageProps {
  qqList: QQInfo[];
  selectedUin: string | null;
  config: OneBotConfig | null;
  saveStatus: string;
  onSelectAccount: (uin: string) => void;
  onSave: () => void;
  onConfigChange: (config: OneBotConfig) => void;
}

function qqAvatarUrl(uin: string): string {
  return `/avatar/${encodeURIComponent(uin)}`;
}

export function ConfigPage({
  qqList, selectedUin, config, saveStatus,
  onSelectAccount, onSave, onConfigChange,
}: ConfigPageProps) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      {/* Account list panel */}
      <div className="w-full shrink-0 xl:sticky xl:top-0 xl:w-60 2xl:w-64">
        <div
          className="rounded-xl overflow-hidden"
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
          <div className="px-4 pt-4 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              在线连接
            </span>
          </div>
          <div className="px-2 pb-3 flex flex-col gap-0.5 sm:grid sm:grid-cols-2 sm:gap-1.5 xl:flex">
            {qqList.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: 'var(--text-tertiary)' }}>暂无在线会话</p>
            ) : qqList.map(q => {
              const isActive = selectedUin === q.uin;
              return (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  key={q.uin}
                  onClick={() => onSelectAccount(q.uin)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left cursor-pointer"
                  style={{
                    background: isActive ? 'var(--accent-subtle)' : 'transparent',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <div
                    className="size-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold shrink-0 overflow-hidden"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, var(--accent), #818cf8)'
                        : 'var(--bg-input)',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
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
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}
                    >
                      {q.nickname}
                    </div>
                    <div
                      className="text-[11px] truncate"
                      style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {q.uin}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 min-w-0">
        {!selectedUin ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <MousePointerClick size={28} strokeWidth={1.2} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>在左栏选择会话以配置通信节点</p>
          </div>
        ) : !config ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 rounded-lg w-48" style={{ background: 'var(--bg-card)' }} />
            <div className="h-32 rounded-xl" style={{ background: 'var(--bg-card)' }} />
            <div className="h-32 rounded-xl" style={{ background: 'var(--bg-card)' }} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  OneBot 协议端点
                </h2>
                <code
                  className="text-xs mt-1 block"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
                >
                  UIN {selectedUin}
                </code>
              </div>
              <div className="flex items-center gap-2.5">
                {saveStatus && (
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      color: saveStatus === '保存成功' ? 'var(--color-success)' : saveStatus === '保存中...' ? 'var(--text-secondary)' : 'var(--color-danger)',
                      background: saveStatus === '保存成功' ? 'rgba(52,211,153,0.1)' : saveStatus === '保存中...' ? 'var(--bg-card)' : 'rgba(248,113,113,0.1)',
                      border: `1px solid ${saveStatus === '保存成功' ? 'rgba(52,211,153,0.2)' : saveStatus === '保存中...' ? 'var(--border-subtle)' : 'rgba(248,113,113,0.2)'}`,
                    }}
                  >
                    {saveStatus}
                  </span>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSave}
                  className="h-8 px-4 rounded-lg text-white text-xs font-medium cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), #818cf8)',
                    boxShadow: '0 2px 12px var(--accent-glow)',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  保存设定
                </motion.button>
              </div>
            </div>

            {/* HTTP Servers */}
            <SectionCard title="HTTP 服务监听" onAdd={() => { const c = { ...config }; c.httpServers = [...c.httpServers, { port: 3000, host: '0.0.0.0', path: '/' }]; onConfigChange(c); }}>
              {config.httpServers.length === 0 ? null : config.httpServers.map((s, idx) => (
                <EndpointRow key={idx} onRemove={() => { const c = { ...config }; c.httpServers = c.httpServers.filter((_, i) => i !== idx); onConfigChange(c); }}>
                  <FieldInput label="端口" value={s.port} isNum flex="w-28" onChange={v => { const c = { ...config }; c.httpServers = c.httpServers.map((item, i) => i === idx ? { ...item, port: v as number } : item); onConfigChange(c); }} />
                  <FieldInput label="授权 Token" placeholder="不填则无密码" value={s.accessToken || ''} onChange={v => { const c = { ...config }; c.httpServers = c.httpServers.map((item, i) => i === idx ? { ...item, accessToken: v as string } : item); onConfigChange(c); }} />
                </EndpointRow>
              ))}
            </SectionCard>

            {/* HTTP Post */}
            <SectionCard title="HTTP Post 推送端点" onAdd={() => { const c = { ...config }; c.httpPostEndpoints = [...c.httpPostEndpoints, { url: 'http://127.0.0.1:5700' }]; onConfigChange(c); }}>
              {config.httpPostEndpoints.length === 0 ? null : config.httpPostEndpoints.map((s, idx) => (
                <EndpointRow key={idx} onRemove={() => { const c = { ...config }; c.httpPostEndpoints = c.httpPostEndpoints.filter((_, i) => i !== idx); onConfigChange(c); }}>
                  <FieldInput label="目标 URL" placeholder="http://..." grow value={s.url || ''} onChange={v => { const c = { ...config }; c.httpPostEndpoints = c.httpPostEndpoints.map((item, i) => i === idx ? { ...item, url: v as string } : item); onConfigChange(c); }} />
                  <FieldInput label="授权 Token" placeholder="可选" value={s.accessToken || ''} onChange={v => { const c = { ...config }; c.httpPostEndpoints = c.httpPostEndpoints.map((item, i) => i === idx ? { ...item, accessToken: v as string } : item); onConfigChange(c); }} />
                </EndpointRow>
              ))}
            </SectionCard>

            {/* WS Servers */}
            <SectionCard title="WebSocket 服务监听" onAdd={() => { const c = { ...config }; c.wsServers = [...c.wsServers, { port: 3001, host: '0.0.0.0', path: '/' }]; onConfigChange(c); }}>
              {config.wsServers.length === 0 ? null : config.wsServers.map((s, idx) => (
                <EndpointRow key={idx} onRemove={() => { const c = { ...config }; c.wsServers = c.wsServers.filter((_, i) => i !== idx); onConfigChange(c); }}>
                  <FieldInput label="端口" value={s.port} isNum flex="w-28" onChange={v => { const c = { ...config }; c.wsServers = c.wsServers.map((item, i) => i === idx ? { ...item, port: v as number } : item); onConfigChange(c); }} />
                  <FieldInput label="授权 Token" placeholder="不填则无密码" value={s.accessToken || ''} onChange={v => { const c = { ...config }; c.wsServers = c.wsServers.map((item, i) => i === idx ? { ...item, accessToken: v as string } : item); onConfigChange(c); }} />
                </EndpointRow>
              ))}
            </SectionCard>

            {/* WS Clients */}
            <SectionCard title="WebSocket 客户端（反向连出）" onAdd={() => { const c = { ...config }; c.wsClients = [...c.wsClients, { url: 'ws://127.0.0.1:8080/ws', reconnectIntervalMs: 5000 }]; onConfigChange(c); }}>
              {config.wsClients.length === 0 ? null : config.wsClients.map((c2, idx) => (
                <EndpointRow key={idx} onRemove={() => { const c = { ...config }; c.wsClients = c.wsClients.filter((_, i) => i !== idx); onConfigChange(c); }}>
                  <FieldInput label="目标 URL" placeholder="ws://..." grow value={c2.url || ''} onChange={v => { const c = { ...config }; c.wsClients = c.wsClients.map((item, i) => i === idx ? { ...item, url: v as string } : item); onConfigChange(c); }} />
                  <FieldInput label="授权 Token" placeholder="可选" value={c2.accessToken || ''} onChange={v => { const c = { ...config }; c.wsClients = c.wsClients.map((item, i) => i === idx ? { ...item, accessToken: v as string } : item); onConfigChange(c); }} />
                </EndpointRow>
              ))}
            </SectionCard>

            {/* Music Sign URL */}
            <SectionCard title="音乐签名 URL" onAdd={() => {}}>
              <div className="px-5 py-4">
                <FieldInput label="签名服务地址" placeholder="留空则不启用" value={config.musicSignUrl || ''} onChange={v => onConfigChange({ ...config, musicSignUrl: (v as string) || undefined })} />
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
