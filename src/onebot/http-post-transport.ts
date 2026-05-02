import type { JsonObject, OneBotConfig, HttpPostEndpoint } from './types';
import { createLogger } from '../utils/logger';

export interface HttpPostTransportContext {
  uin: string;
  api: import('./api-handler').ApiHandler;
}

const log = createLogger('OneBot.POST');
const DEFAULT_TIMEOUT_MS = 5000;

export class HttpPostTransport {
  private readonly context: HttpPostTransportContext;
  private endpoints: HttpPostEndpoint[] = [];
  private stopped = false;

  constructor(config: OneBotConfig, context: HttpPostTransportContext) {
    this.endpoints = [...config.httpPostEndpoints];
    this.context = context;
  }

  start(): void {
    this.stopped = false;
    const count = this.endpoints.length;
    if (count > 0) {
      log.info('configured %d HTTP POST endpoint(s)', count);
    }
  }

  reloadConfig(config: OneBotConfig): void {
    this.endpoints = [...config.httpPostEndpoints];
    log.info('reloaded %d HTTP POST endpoint(s)', this.endpoints.length);
  }

  stop(): void {
    this.stopped = true;
  }

  publishEvent(event: JsonObject): void {
    const endpoints = this.endpoints;
    if (!endpoints || endpoints.length === 0) return;

    const payload = JSON.stringify(event);
    for (const endpoint of endpoints) {
      void this.postEvent(endpoint, payload, event);
    }
  }

  private async postEvent(endpoint: HttpPostEndpoint, payload: string, event: JsonObject): Promise<void> {
    if (this.stopped) return;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'OneBot',
      'X-Self-ID': this.context.uin,
    };

    if (endpoint.accessToken) {
      headers['X-Signature'] = await computeHmacSha1(endpoint.accessToken, payload);
    }

    const timeoutMs = endpoint.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });

      // OneBot v11: if the response has a JSON body, it's a quick operation
      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const body = await response.text();
          if (body.trim()) {
            await this.handleQuickOperation(event, body);
          }
        }
      } else {
        log.warn('POST %s returned %d', endpoint.url, response.status);
      }
    } catch (error) {
      if (!this.stopped) {
        log.warn('POST %s failed: %s', endpoint.url, error instanceof Error ? error.message : String(error));
      }
    }
  }

  private async handleQuickOperation(event: JsonObject, responseBody: string): Promise<void> {
    try {
      const operation = JSON.parse(responseBody) as Record<string, unknown>;
      if (!operation || typeof operation !== 'object') return;

      await executeQuickOperation(event, operation, this.context.api);
    } catch (error) {
      log.warn('quick operation failed: %s', error instanceof Error ? error.message : String(error));
    }
  }
}

async function computeHmacSha1(secret: string, payload: string): Promise<string> {
  const { createHmac } = await import('crypto');
  return 'sha1=' + createHmac('sha1', secret).update(payload).digest('hex');
}

/**
 * Execute a quick operation based on the event type and the response body.
 * This implements the .handle_quick_operation hidden API behavior.
 * See: https://github.com/botuniverse/onebot-11/blob/master/api/hidden.md
 */
export async function executeQuickOperation(
  event: JsonObject,
  operation: Record<string, unknown>,
  api: import('./api-handler').ApiHandler,
): Promise<void> {
  const postType = event.post_type as string;

  if (postType === 'message') {
    // Quick reply
    if (operation.reply !== undefined && operation.reply !== null && operation.reply !== '') {
      const messageType = event.message_type as string;
      const autoEscape = !!operation.auto_escape;

      if (messageType === 'group') {
        const params: JsonObject = {
          group_id: event.group_id as number,
          message: operation.reply as import('./types').JsonValue,
          auto_escape: autoEscape,
        };
        // at_sender defaults to true for group messages
        if (operation.at_sender !== false && event.user_id) {
          // Prepend an @ segment
          const atSegment = { type: 'at', data: { qq: String(event.user_id) } };
          if (typeof operation.reply === 'string') {
            params.message = [atSegment, { type: 'text', data: { text: operation.reply as string } }] as import('./types').JsonValue;
            params.auto_escape = false;
          } else if (Array.isArray(operation.reply)) {
            params.message = [atSegment, ...(operation.reply as unknown[])] as import('./types').JsonValue;
          }
        }
        await api.handle('send_group_msg', params);
      } else if (messageType === 'private') {
        await api.handle('send_private_msg', {
          user_id: event.user_id as number,
          message: operation.reply as import('./types').JsonValue,
          auto_escape: autoEscape,
        });
      }
    }

    // Quick delete
    if (operation.delete) {
      await api.handle('delete_msg', { message_id: event.message_id as number });
    }

    // Quick ban (group only)
    if (operation.ban && event.message_type === 'group') {
      const duration = typeof operation.ban_duration === 'number' ? operation.ban_duration : 1800;
      await api.handle('set_group_ban', {
        group_id: event.group_id as number,
        user_id: event.user_id as number,
        duration: duration as import('./types').JsonValue,
      });
    }

    // Quick kick (group only)
    if (operation.kick && event.message_type === 'group') {
      await api.handle('set_group_kick', {
        group_id: event.group_id as number,
        user_id: event.user_id as number,
        reject_add_request: !!operation.reject_add_request as unknown as import('./types').JsonValue,
      });
    }
  }

  if (postType === 'request') {
    if (operation.approve !== undefined) {
      const requestType = event.request_type as string;
      if (requestType === 'friend') {
        await api.handle('set_friend_add_request', {
          flag: event.flag as string,
          approve: operation.approve as import('./types').JsonValue,
          remark: (operation.remark ?? '') as import('./types').JsonValue,
        });
      } else if (requestType === 'group') {
        await api.handle('set_group_add_request', {
          flag: event.flag as string,
          sub_type: event.sub_type as string,
          approve: operation.approve as import('./types').JsonValue,
          reason: (operation.reason ?? '') as import('./types').JsonValue,
        });
      }
    }
  }
}
