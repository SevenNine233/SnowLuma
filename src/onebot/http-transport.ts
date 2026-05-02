import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'http';
import type { ApiHandler } from './api-handler';
import type { OneBotConfig } from './types';
import { createLogger } from '../utils/logger';

export interface HttpTransportContext {
  api: ApiHandler;
}

const log = createLogger('OneBot.HTTP');

export class HttpTransport {
  private readonly config: OneBotConfig;
  private readonly context: HttpTransportContext;
  private readonly servers: Server[] = [];

  constructor(config: OneBotConfig, context: HttpTransportContext) {
    this.config = config;
    this.context = context;
  }

  start(): void {
    for (const endpoint of this.config.httpServers) {
      const expectedPath = normalizePath(endpoint.path ?? '/');
      const endpointToken = endpoint.accessToken ?? '';
      const server = createServer((req, res) => {
        void this.handleRequest(expectedPath, endpointToken, req, res);
      });

      server.on('listening', () => {
        const label = endpoint.name ? `[${endpoint.name}] ` : '';
        log.success('%slistening %s:%d%s', label, endpoint.host, endpoint.port, expectedPath);
      });

      server.on('error', (error) => {
        log.warn('server error: %s', error instanceof Error ? error.message : String(error));
      });

      server.listen(endpoint.port, endpoint.host);
      this.servers.push(server);
    }
  }

  stop(): void {
    for (const server of this.servers) {
      server.close();
    }
    this.servers.length = 0;
  }

  private async handleRequest(expectedPath: string, accessToken: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const parsedUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
    const incomingPath = parsedUrl.pathname;
    
    // Determine the expected prefix (e.g., "/" or "/api/")
    const ep = expectedPath.endsWith('/') ? expectedPath : expectedPath + '/';
    let action = '';

    if (incomingPath === expectedPath || incomingPath === expectedPath + '/') {
      action = ''; // No action in URL (legacy body mode)
    } else if (incomingPath.startsWith(ep)) {
      action = incomingPath.substring(ep.length); // Extract action from URL
    } else {
      writeJson(res, 404, { status: 'failed', retcode: 1404, data: null, wording: 'not found' });
      return;
    }

    if (!isAuthorized(req, accessToken)) {
      writeJson(res, 401, { status: 'failed', retcode: 1401, data: null, wording: 'unauthorized' });
      return;
    }

    if (req.method === 'GET' && !action) {
      writeJson(res, 200, { status: 'ok', retcode: 0, data: { online: true } });
      return;
    }

    try {
      let params: Record<string, unknown> = {};
      let echo: unknown;

      if (req.method === 'GET') {
        parsedUrl.searchParams.forEach((value, key) => {
          try {
            params[key] = JSON.parse(value);
          } catch {
            params[key] = value;
          }
        });
      } else if (req.method === 'POST') {
        const bodyContent = await readRequestBody(req);
        if (bodyContent.trim()) {
          try {
            const parsedBody = JSON.parse(bodyContent);
            if (typeof parsedBody === 'object' && parsedBody !== null && !Array.isArray(parsedBody)) {
              // Legacy format: { action: "...", params: {...} } vs standard raw params
              if (parsedBody.action && !action) {
                action = String(parsedBody.action);
              }
              if (parsedBody.params && typeof parsedBody.params === 'object' && !Array.isArray(parsedBody.params)) {
                 params = parsedBody.params as Record<string, unknown>;
              } else {
                 params = parsedBody as Record<string, unknown>;
              }
              echo = parsedBody.echo;
            }
          } catch {
            writeJson(res, 400, { status: 'failed', retcode: 1400, data: null, wording: 'bad request: invalid json' });
            return;
          }
        }
      } else {
        writeJson(res, 405, { status: 'failed', retcode: 1400, data: null, wording: 'method not allowed' });
        return;
      }

      if (!action) {
        writeJson(res, 400, { status: 'failed', retcode: 1400, data: null, wording: 'bad request: missing action' });
        return;
      }

      // Handle the API call
      const response = await this.context.api.handle(action, params as import('./types').JsonObject);
      
      if (echo !== undefined) {
        response.echo = echo as import('./types').JsonValue;
      }

      writeJson(res, 200, response);
    } catch (error) {
      const wording = error instanceof Error ? error.message : 'internal error';
      writeJson(res, 500, { status: 'failed', retcode: 1200, data: null, wording });
    }
  }
}

function parseRequestPath(urlValue: string): string {
  try {
    return new URL(urlValue, 'http://127.0.0.1').pathname;
  } catch {
    return '/';
  }
}

function normalizePath(pathValue: string): string {
  const path = pathValue.trim() || '/';
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function isAuthorized(request: IncomingMessage, token: string): boolean {
  if (!token) return true;
  // 1. Header auth
  const rawAuth = request.headers.authorization;
  const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth ?? '';
  if (auth === `Bearer ${token}`) return true;

  // 2. Query string auth
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.searchParams.get('access_token') === token) {
      return true;
    }
  } catch {}

  return false;
}

function readRequestBody(req: IncomingMessage, maxBytes = 2 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
