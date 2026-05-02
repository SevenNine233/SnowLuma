import WebSocket, { WebSocketServer } from 'ws';
import type { IncomingHttpHeaders, IncomingMessage } from 'http';
import type { ApiHandler } from './api-handler';
import type { JsonObject, OneBotConfig, WsClientEndpoint, WsRole, WsServerEndpoint } from './types';
import { createLogger } from '../utils/logger';

interface ForwardConnection {
  socket: WebSocket;
  role: WsRole;
}

interface ReverseConnection {
  socket: WebSocket;
  role: WsRole;
  endpointUrl: string;
  reconnectIntervalMs: number;
  key: string;
}

export interface WsTransportContext {
  uin: string;
  api: ApiHandler;
  buildLifecycleEvent: (subType: 'connect' | 'enable' | 'disable') => JsonObject;
  buildHeartbeatEvent: () => JsonObject;
}

const log = createLogger('OneBot.WS');

export class WsTransport {
  private readonly context: WsTransportContext;

  private readonly servers = new Map<string, WebSocketServer>();
  private readonly forwardConnections = new Map<WebSocket, ForwardConnection>();
  private readonly reverseConnections = new Set<ReverseConnection>();
  private readonly reconnectTimers = new Set<NodeJS.Timeout>();
  private serverEndpoints: WsServerEndpoint[] = [];
  private clientEndpoints: WsClientEndpoint[] = [];
  private stopped = false;

  constructor(config: OneBotConfig, context: WsTransportContext) {
    this.serverEndpoints = [...config.wsServers];
    this.clientEndpoints = [...config.wsClients];
    this.context = context;
  }

  start(): void {
    this.stopped = false;
    this.startServers();
    this.startReverseClients();
  }

  reloadConfig(config: OneBotConfig): void {
    const nextServers = [...config.wsServers];
    const nextClients = [...config.wsClients];
    const nextServerKeys = new Set(nextServers.map(wsServerKey));
    const nextClientKeys = new Set(nextClients.map(wsClientKey));

    for (const [key, server] of this.servers) {
      if (!nextServerKeys.has(key)) {
        server.close();
        this.servers.delete(key);
        log.info('stopped forward server %s', key);
      }
    }

    for (const endpoint of nextServers) {
      if (!this.servers.has(wsServerKey(endpoint))) {
        this.startServerEndpoint(endpoint);
      }
    }

    for (const conn of [...this.reverseConnections]) {
      if (!nextClientKeys.has(conn.key)) {
        safeClose(conn.socket);
        this.reverseConnections.delete(conn);
        log.info('stopped reverse client %s', conn.endpointUrl);
      }
    }

    for (const endpoint of nextClients) {
      const key = wsClientKey(endpoint);
      if (![...this.reverseConnections].some(conn => conn.key === key)) {
        this.startClientEndpoint(endpoint);
      }
    }

    this.serverEndpoints = nextServers;
    this.clientEndpoints = nextClients;
  }

  stop(): void {
    this.stopped = true;
    this.publishEvent(this.context.buildLifecycleEvent('disable'));

    for (const timer of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    for (const [socket] of this.forwardConnections) {
      safeClose(socket);
    }
    this.forwardConnections.clear();

    for (const conn of this.reverseConnections) {
      safeClose(conn.socket);
    }
    this.reverseConnections.clear();

    for (const server of this.servers.values()) {
      server.close();
    }
    this.servers.clear();
  }

  publishEvent(event: JsonObject): void {
    const payload = JSON.stringify(event);

    for (const { socket, role } of this.forwardConnections.values()) {
      if (role === 'event' || role === 'universal') {
        safeSend(socket, payload);
      }
    }

    for (const { socket, role } of this.reverseConnections.values()) {
      if (role === 'event' || role === 'universal') {
        safeSend(socket, payload);
      }
    }
  }

  private startServers(): void {
    for (const endpoint of this.serverEndpoints) {
      this.startServerEndpoint(endpoint);
    }
  }

  private startServerEndpoint(endpoint: WsServerEndpoint): void {
      const wss = new WebSocketServer({
        host: endpoint.host,
        port: endpoint.port,
        path: endpoint.path ?? '/',
      });

      wss.on('listening', () => {
        const label = endpoint.name ? `[${endpoint.name}] ` : '';
        log.success('%slistening %s:%d%s', label, endpoint.host, endpoint.port, endpoint.path ?? '/');
      });

      wss.on('connection', (socket, request) => {
        if (!isAuthorized(request, endpoint.accessToken ?? '')) {
          safeClose(socket, 1008, 'invalid access token');
          return;
        }

        const role = endpoint.role ?? classifyForwardRole(request);
        const conn: ForwardConnection = { socket, role };
        this.forwardConnections.set(socket, conn);

        socket.on('message', (raw) => {
          void this.handleApiMessage(socket, role, raw);
        });

        socket.on('close', () => {
          this.forwardConnections.delete(socket);
        });

        socket.on('error', (error) => {
          log.warn('forward socket error: %s', error instanceof Error ? error.message : String(error));
        });

        this.sendBootstrapMetaEvents(socket, role);
      });

      wss.on('error', (error) => {
        log.warn('server error: %s', error instanceof Error ? error.message : String(error));
      });

      this.servers.set(wsServerKey(endpoint), wss);
  }

  private startReverseClients(): void {
    for (const endpoint of this.clientEndpoints) this.startClientEndpoint(endpoint);
  }

  private startClientEndpoint(endpoint: WsClientEndpoint): void {
    const role = endpoint.role ?? 'universal';
    const reconnectIntervalMs = Math.max(1000, endpoint.reconnectIntervalMs ?? 5000);
    this.connectReverseClient(endpoint.url, role, reconnectIntervalMs, endpoint.accessToken ?? '', endpoint.name);
  }

  private connectReverseClient(endpointUrl: string, role: WsRole, reconnectIntervalMs: number, accessToken: string, name?: string): void {
    if (this.stopped) return;

    const headers: Record<string, string> = {
      'User-Agent': 'OneBot',
      'X-Self-ID': this.context.uin,
      'X-Client-Role': role,
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const socket = new WebSocket(endpointUrl, { headers });
    const conn: ReverseConnection = { socket, role, endpointUrl, reconnectIntervalMs, key: wsClientPartsKey(endpointUrl, role, reconnectIntervalMs, accessToken) };
    this.reverseConnections.add(conn);

    socket.on('open', () => {
      const label = name ? `[${name}] ` : '';
      log.info('%sreverse connected %s', label, endpointUrl);
      this.sendBootstrapMetaEvents(socket, role);
    });

    socket.on('message', (raw) => {
      void this.handleApiMessage(socket, role, raw);
    });

    socket.on('close', () => {
      this.reverseConnections.delete(conn);
      if (this.stopped) return;

      const timer = setTimeout(() => {
        this.reconnectTimers.delete(timer);
        this.connectReverseClient(endpointUrl, role, reconnectIntervalMs, accessToken, name);
      }, reconnectIntervalMs);
      timer.unref?.();
      this.reconnectTimers.add(timer);
    });

    socket.on('error', (error) => {
      log.warn('reverse error %s: %s', endpointUrl, error instanceof Error ? error.message : String(error));
    });
  }

  private async handleApiMessage(socket: WebSocket, role: WsRole, raw: WebSocket.RawData): Promise<void> {
    if (role !== 'api' && role !== 'universal') return;

    const text = rawDataToString(raw);
    if (!text) return;

    const response = await this.context.api.processRequest(text);
    safeSend(socket, response);
  }

  private sendBootstrapMetaEvents(socket: WebSocket, role: WsRole): void {
    if (role !== 'event' && role !== 'universal') return;

    const connectEvent = this.context.buildLifecycleEvent('connect');
    const enableEvent = this.context.buildLifecycleEvent('enable');
    const heartbeatEvent = this.context.buildHeartbeatEvent();

    safeSend(socket, JSON.stringify(connectEvent));
    safeSend(socket, JSON.stringify(enableEvent));
    safeSend(socket, JSON.stringify(heartbeatEvent));
  }
}

function classifyForwardRole(request: IncomingMessage): WsRole {
  const path = parseRequestPath(request.url ?? '/');
  if (path.endsWith('/api')) return 'api';
  if (path.endsWith('/event')) return 'event';
  return 'universal';
}

function parseRequestPath(urlValue: string): string {
  try {
    return new URL(urlValue, 'ws://127.0.0.1').pathname;
  } catch {
    return '/';
  }
}

function normalizeWsPath(pathValue: string | undefined): string {
  const path = (pathValue ?? '/').trim() || '/';
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function wsServerKey(endpoint: WsServerEndpoint): string {
  return `${endpoint.host}:${endpoint.port}${normalizeWsPath(endpoint.path)}#${endpoint.role ?? 'auto'}#${endpoint.accessToken ?? ''}`;
}

function wsClientPartsKey(endpointUrl: string, role: WsRole, reconnectIntervalMs: number, accessToken: string): string {
  return `${endpointUrl}#${role}#${reconnectIntervalMs}#${accessToken}`;
}

function wsClientKey(endpoint: WsClientEndpoint): string {
  const role = endpoint.role ?? 'universal';
  const reconnectIntervalMs = Math.max(1000, endpoint.reconnectIntervalMs ?? 5000);
  return wsClientPartsKey(endpoint.url, role, reconnectIntervalMs, endpoint.accessToken ?? '');
}

function isAuthorized(request: IncomingMessage, token: string): boolean {
  if (!token) return true;
  // 1. Header auth
  const rawAuth = request.headers.authorization;
  const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth ?? '';
  if (auth === `Bearer ${token}`) return true;

  // 2. Query string auth
  try {
    const url = new URL(request.url ?? '/', 'ws://127.0.0.1');
    if (url.searchParams.get('access_token') === token) {
      return true;
    }
  } catch {}

  return false;
}

function rawDataToString(raw: WebSocket.RawData): string {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Buffer) return raw.toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw)).toString('utf8');
  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8');
  }
  return '';
}

function safeSend(socket: WebSocket, payload: string): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(payload, (error) => {
    if (error) {
      log.warn('send error: %s', error instanceof Error ? error.message : String(error));
    }
  });
}

function safeClose(socket: WebSocket, code = 1000, reason = 'normal'): void {
  if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) return;
  socket.close(code, reason);
}
