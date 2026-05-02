import { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './components/pages/LoginPage';
import { OverviewPage } from './components/pages/OverviewPage';
import { ConfigPage } from './components/pages/ConfigPage';
import { LogsPage } from './components/pages/LogsPage';
import type { QQInfo, OneBotConfig, HookProcessInfo } from './types';

const fetchApi = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('snowluma_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};

function App() {
  const [status, setStatus] = useState('连接中');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
    import.meta.env.VITE_SKIP_AUTH === 'true' ? true : null
  );
  const [activePage, setActivePage] = useState<'总览' | '配置' | '日志'>('总览');
  const [qqList, setQqList] = useState<QQInfo[]>([]);
  const [processList, setProcessList] = useState<HookProcessInfo[]>([]);
  const [processLoadingPid, setProcessLoadingPid] = useState<number | null>(null);
  const [processUnloadingPid, setProcessUnloadingPid] = useState<number | null>(null);
  const [processActionStatus, setProcessActionStatus] = useState('');
  const [selectedUin, setSelectedUin] = useState<string | null>(null);
  const [config, setConfig] = useState<OneBotConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState('');

  function checkStatus() {
    fetchApi('/api/status')
      .then(async (res) => {
        if (res.status === 401) { setIsAuthenticated(false); setStatus('需要认证'); return; }
        if (res.ok) {
          setIsAuthenticated(true);
          const data = await res.json();
          setStatus(data.status === 'running' ? '已连接' : '已断开');
          fetchQqList();
          fetchProcesses();
          return;
        }
        // Any other non-ok status (502, 500, etc.)
        setIsAuthenticated(false);
        setStatus('已断开');
      })
      .catch(() => { setStatus('已断开'); setIsAuthenticated(false); });
  }

  useEffect(() => {
    if (import.meta.env.VITE_SKIP_AUTH !== 'true') checkStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated !== true) return;
    fetchQqList();
    fetchProcesses();
    const timer = window.setInterval(() => {
      fetchQqList();
      fetchProcesses();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated]);

  const handleLogin = async (password: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('snowluma_token', data.token);
        setIsAuthenticated(true);
        checkStatus();
        return { success: true };
      }
      return { success: false, error: '认证失败，请检查控制台日志' };
    } catch {
      return { success: false, error: '内部错误，请检查后端运行状态' };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('snowluma_token');
    setIsAuthenticated(false);
    setStatus('需要认证');
    setQqList([]);
    setProcessList([]);
    setConfig(null);
  };

  async function fetchQqList() {
    try {
      const res = await fetchApi('/api/qq-list');
      if (res.ok) { const data = await res.json(); setQqList(data.list || []); }
    } catch (err) { console.error(err); }
  }

  async function fetchProcesses() {
    try {
      const res = await fetchApi('/api/processes');
      if (res.ok) { const data = await res.json(); setProcessList(data.list || []); }
    } catch (err) { console.error(err); }
  }

  const loadProcess = async (pid: number) => {
    setProcessLoadingPid(pid);
    setProcessActionStatus('正在手动映射加载 SnowLuma...');
    try {
      const res = await fetchApi(`/api/processes/${pid}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      setProcessActionStatus(res.ok && data.success ? '已开始监听登录状态' : data.message || '加载失败');
      await fetchProcesses();
      await fetchQqList();
    } catch {
      setProcessActionStatus('网络错误，加载失败');
    } finally {
      setProcessLoadingPid(null);
      setTimeout(() => setProcessActionStatus(''), 3000);
    }
  };

  const unloadProcess = async (pid: number) => {
    setProcessUnloadingPid(pid);
    setProcessActionStatus('正在卸载 SnowLuma...');
    try {
      const res = await fetchApi(`/api/processes/${pid}/unload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      setProcessActionStatus(res.ok && data.success ? '已卸载 SnowLuma' : data.message || '卸载失败');
      await fetchProcesses();
      await fetchQqList();
    } catch {
      setProcessActionStatus('网络错误，卸载失败');
    } finally {
      setProcessUnloadingPid(null);
      setTimeout(() => setProcessActionStatus(''), 3000);
    }
  };

  const loadConfig = async (uin: string) => {
    setSelectedUin(uin);
    setSaveStatus('');
    setConfig(null);
    try {
      const res = await fetchApi(`/api/config/${uin}`);
      if (res.ok) { const data = await res.json(); setConfig(data.config); }
    } catch (err) { console.error(err); }
  };

  const saveConfig = async () => {
    if (!selectedUin || !config) return;
    setSaveStatus('保存中...');
    try {
      const res = await fetchApi(`/api/config/${selectedUin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setSaveStatus(res.ok ? '保存成功' : '保存出错');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch {
      setSaveStatus('网络错误');
    }
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>
        <div className="size-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  // Login
  if (isAuthenticated === false) {
    return (
      <ThemeProvider>
        <LoginPage onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  // Main app
  return (
    <ThemeProvider>
      <MainLayout activePage={activePage} onNavigate={setActivePage} status={status} onLogout={handleLogout}>
        {activePage === '总览' && (
          <OverviewPage
            qqList={qqList}
            status={status}
            processList={processList}
            processLoadingPid={processLoadingPid}
            processUnloadingPid={processUnloadingPid}
            processActionStatus={processActionStatus}
            onRefreshProcesses={fetchProcesses}
            onLoadProcess={loadProcess}
            onUnloadProcess={unloadProcess}
          />
        )}
        {activePage === '配置' && (
          <ConfigPage
            qqList={qqList}
            selectedUin={selectedUin}
            config={config}
            saveStatus={saveStatus}
            onSelectAccount={loadConfig}
            onSave={saveConfig}
            onConfigChange={setConfig}
          />
        )}
        {activePage === '日志' && (
          <LogsPage fetchApi={fetchApi} />
        )}
      </MainLayout>
    </ThemeProvider>
  );
}

export default App;
