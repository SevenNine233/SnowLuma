import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createLogger } from '../utils/logger';
import { randomBytes } from 'crypto';
import type { OneBotManager } from '../onebot/manager';
import { loadOneBotConfig, saveOneBotConfig } from '../onebot/config';
import type { OneBotConfig } from '../onebot/types';
import type { HookManager } from '../hook/hook-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const log = createLogger('WebUI');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Session token store: token -> expiry timestamp (24h)
const sessionTokens = new Map<string, number>();

// Login attempt tracker: ip -> { count, resetAt }
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const AVATAR_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AVATAR_BROWSER_CACHE_SECONDS = 30 * 24 * 60 * 60;

const avatarCache = new Map<string, { body: Uint8Array; contentType: string; expiresAt: number }>();

function purgeExpiredTokens() {
  const now = Date.now();
  for (const [token, expiry] of sessionTokens) {
    if (now > expiry) sessionTokens.delete(token);
  }
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
}

async function fetchQqAvatar(uin: string): Promise<{ body: Uint8Array; contentType: string }> {
  const response = await fetch(`https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(uin)}&s=100`, {
    headers: {
      'User-Agent': 'SnowLuma WebUI',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`avatar upstream responded with ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const body = new Uint8Array(await response.arrayBuffer());
  return { body, contentType };
}

export function initWebUI(port: number = 8080, oneBotManager: OneBotManager, hookManager?: HookManager) {
  const app = new Hono();

  // Generate random password (printed once at startup)
  const randomPassword = randomBytes(8).toString('hex');
  log.info(`=========================================`);
  log.info(`WebUI 安全认证`);
  log.info(`默认用户: admin`);
  log.info(`临时密码: ${randomPassword}`);
  log.info(`=========================================`);

  // API Auth middleware
  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/login') {
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
    }

    purgeExpiredTokens();
    const token = authHeader.slice(7);
    const expiry = sessionTokens.get(token);
    if (!expiry || Date.now() > expiry) {
      return c.json({ status: 'failed', message: 'Token expired or invalid' }, 401);
    }

    await next();
  });

  // Login Endpoint with rate limiting
  app.post('/api/login', async (c) => {
    const ip = getClientIp(c.req.raw);
    const now = Date.now();
    const attempt = loginAttempts.get(ip);

    if (attempt && attempt.count >= LOGIN_MAX_ATTEMPTS && now < attempt.resetAt) {
      const waitSec = Math.ceil((attempt.resetAt - now) / 1000);
      return c.json({ success: false, message: `登录尝试过多，请 ${waitSec} 秒后重试` }, 429);
    }

    try {
      const { password } = await c.req.json();
      if (password === randomPassword) {
        loginAttempts.delete(ip);
        purgeExpiredTokens();
        const token = randomBytes(32).toString('hex');
        sessionTokens.set(token, now + TOKEN_TTL_MS);
        return c.json({ success: true, token });
      }

      const current = loginAttempts.get(ip) ?? { count: 0, resetAt: now + LOGIN_LOCKOUT_MS };
      current.count += 1;
      if (current.count === 1) current.resetAt = now + LOGIN_LOCKOUT_MS;
      loginAttempts.set(ip, current);

      return c.json({ success: false, message: '密码错误' }, 401);
    } catch {
      return c.json({ success: false, message: '请求格式错误' }, 400);
    }
  });

  app.get('/avatar/:uin', async (c) => {
    const uin = c.req.param('uin');
    if (!/^\d{5,12}$/.test(uin)) {
      return c.text('invalid uin', 400);
    }

    const now = Date.now();
    let cached = avatarCache.get(uin);
    if (!cached || cached.expiresAt <= now) {
      try {
        const avatar = await fetchQqAvatar(uin);
        cached = { ...avatar, expiresAt: now + AVATAR_CACHE_TTL_MS };
        avatarCache.set(uin, cached);
      } catch (err) {
        log.warn('failed to proxy avatar for UIN %s: %s', uin, err instanceof Error ? err.message : String(err));
        if (!cached) return c.text('avatar unavailable', 502);
      }
    }

    return new Response(cached.body, {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': `public, max-age=${AVATAR_BROWSER_CACHE_SECONDS}, immutable`,
      },
    });
  });

  // API Routes
  app.get('/api/status', (c) => {
    return c.json({ status: 'running' });
  });

  app.get('/api/qq-list', (c) => {
    const instances = oneBotManager.getInstances();
    const list = instances.map(inst => ({
      uin: inst.uin,
      nickname: inst.qqInfo.nickname
    }));
    return c.json({ list });
  });

  app.get('/api/processes', async (c) => {
    if (!hookManager) return c.json({ list: [] });
    try {
      return c.json({ list: await hookManager.listProcesses() });
    } catch (err) {
      return c.json({ list: [], message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  app.post('/api/processes/:pid/load', async (c) => {
    if (!hookManager) return c.json({ success: false, message: 'hook manager is not available' }, 503);
    const pid = Number(c.req.param('pid'));
    if (!Number.isInteger(pid) || pid <= 0) {
      return c.json({ success: false, message: 'invalid pid' }, 400);
    }
    try {
      const processInfo = await hookManager.loadProcess(pid);
      return c.json({ success: processInfo.status !== 'error', process: processInfo });
    } catch (err) {
      return c.json({ success: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  app.post('/api/processes/:pid/unload', async (c) => {
    if (!hookManager) return c.json({ success: false, message: 'hook manager is not available' }, 503);
    const pid = Number(c.req.param('pid'));
    if (!Number.isInteger(pid) || pid <= 0) {
      return c.json({ success: false, message: 'invalid pid' }, 400);
    }
    try {
      const processInfo = await hookManager.unloadProcess(pid);
      return c.json({ success: processInfo.status !== 'error', process: processInfo });
    } catch (err) {
      return c.json({ success: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  app.get('/api/config/:uin', (c) => {
    const uin = c.req.param('uin');
    const config = loadOneBotConfig(uin);
    return c.json({ config });
  });

  app.post('/api/config/:uin', async (c) => {
    try {
      const uin = c.req.param('uin');
      const body = await c.req.json() as OneBotConfig;
      saveOneBotConfig(uin, body);
      log.info(`Updated OneBot config for UIN: ${uin}`);
      return c.json({ success: true, message: '配置保存成功，将在下次会话重连时生效。' });
    } catch (err) {
      return c.json({ success: false, message: String(err) }, 400);
    }
  });

  // Serve static files generated by the React frontend
  const staticRoot = path.join(__dirname, 'client');
  app.use('/*', serveStatic({ root: staticRoot }));

  serve({
    fetch: app.fetch,
    port
  }, (info) => {
    log.info(`WebUI server is listening on http://localhost:${info.port}`);
  });
}
