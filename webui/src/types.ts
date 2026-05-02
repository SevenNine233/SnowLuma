export interface QQInfo {
  uin: string;
  nickname: string;
}

export interface HookProcessInfo {
  pid: number;
  name: string;
  path: string;
  injected: boolean;
  connected: boolean;
  loggedIn: boolean;
  uin: string;
  status: 'available' | 'loading' | 'loaded' | 'online' | 'error' | 'disconnected';
  error: string;
  method: string;
}

export interface HttpServerEndpoint {
  name?: string;
  host?: string;
  port?: number;
  path?: string;
  accessToken?: string;
}

export interface WsServerEndpoint {
  name?: string;
  host?: string;
  port?: number;
  path?: string;
  role?: string;
  accessToken?: string;
}

export interface WsClientEndpoint {
  name?: string;
  url?: string;
  role?: string;
  reconnectIntervalMs?: number;
  accessToken?: string;
}

export interface HttpPostEndpoint {
  name?: string;
  url?: string;
  accessToken?: string;
  timeoutMs?: number;
}

export interface OneBotConfig {
  httpServers: HttpServerEndpoint[];
  httpPostEndpoints: HttpPostEndpoint[];
  wsServers: WsServerEndpoint[];
  wsClients: WsClientEndpoint[];
  musicSignUrl?: string;
}
