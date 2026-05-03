export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export interface ApiResponse {
  status: 'ok' | 'failed';
  retcode: number;
  data: JsonValue;
  echo?: JsonValue;
  wording?: string;
}

export interface OneBotRequest {
  action: string;
  params?: JsonObject;
  echo?: JsonValue;
}

export interface WsServerEndpoint {
  name?: string;
  host: string;
  port: number;
  path?: string;
  role?: WsRole;
  accessToken?: string;
}

export interface HttpServerEndpoint {
  name?: string;
  host: string;
  port: number;
  path?: string;
  accessToken?: string;
}

export interface WsClientEndpoint {
  name?: string;
  url: string;
  role?: WsRole;
  reconnectIntervalMs?: number;
  accessToken?: string;
}

export interface HttpPostEndpoint {
  name?: string;
  url: string;
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

export type WsRole = 'api' | 'event' | 'universal';

export interface MessageMeta {
  isGroup: boolean;
  targetId: number;
  sequence: number;
  eventName: string;
  clientSequence: number;
  random: number;
  timestamp: number;
}

export const RETCODE = {
  ACTION_FAILED: 100,
  INTERNAL_ERROR: 1200,
  BAD_REQUEST: 1400,
  UNKNOWN_ACTION: 1404,
} as const;

export function okResponse(data: JsonValue = null): ApiResponse {
  return {
    status: 'ok',
    retcode: 0,
    data,
  };
}

export function failedResponse(retcode: number, wording: string): ApiResponse {
  return {
    status: 'failed',
    retcode,
    data: null,
    wording,
  };
}
