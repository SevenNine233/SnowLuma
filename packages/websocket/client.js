import { EventEmitter } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import native from './native.js';
import {
  offerPerMessageDeflate,
  parseAcceptedPerMessageDeflate,
} from './extensions.js';
import { WebSocket, CONNECTING, OPEN, isValidCloseCode } from './websocket.js';

function parseHeaders(headerBlock) {
  const lines = headerBlock.split('\r\n');
  const status = lines.shift();
  const m = /^HTTP\/1\.1\s+(\d+)\s*(.*)$/.exec(status);
  if (!m) throw new Error('Bad HTTP status line: ' + status);
  const headers = Object.create(null);
  for (const line of lines) {
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    headers[k] = v;
  }
  return { statusCode: Number(m[1]), statusMessage: m[2], headers };
}

class WebSocketClient extends EventEmitter {
  constructor(address, protocols, options) {
    super();
    if (typeof protocols === 'object' && !Array.isArray(protocols) && protocols !== null) {
      options = protocols;
      protocols = undefined;
    }
    options = options || {};
    this._url = new URL(address);
    if (this._url.protocol !== 'ws:' && this._url.protocol !== 'wss:') {
      throw new Error('Only ws: and wss: URLs are supported');
    }
    this._secure = this._url.protocol === 'wss:';
    this._readyState = CONNECTING;
    this._maxPayload = options.maxPayload;
    this._ws = null;
    this._pendingQueue = [];
    this._perMessageDeflate = options.perMessageDeflate;
    this._protocols = Array.isArray(protocols) ? protocols.map(String) : undefined;
    this.protocol = '';
    this.extensions = '';

    const host = this._url.hostname;
    const port = this._url.port ? Number(this._url.port) : (this._secure ? 443 : 80);

    // Generate random 16-byte Sec-WebSocket-Key per RFC 6455 §4.1.
    const keyBytes = crypto.randomBytes(16);
    this._wsKey = keyBytes.toString('base64');
    this._expectedAccept = native.computeAcceptKey(this._wsKey);

    const connectOpts = {
      host,
      port,
      ...(options.socketOptions || {}),
    };

    const onConnect = () => {
      const pathAndQuery = (this._url.pathname || '/') + (this._url.search || '');
      const hostHeader = (this._url.port && Number(this._url.port) !== (this._secure ? 443 : 80))
        ? `${host}:${this._url.port}`
        : host;
      const reqLines = [
        `GET ${pathAndQuery} HTTP/1.1`,
        `Host: ${hostHeader}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${this._wsKey}`,
        'Sec-WebSocket-Version: 13',
      ];
      if (Array.isArray(protocols) && protocols.length > 0) {
        reqLines.push(`Sec-WebSocket-Protocol: ${protocols.join(', ')}`);
      }
      const extensionOffer = offerPerMessageDeflate(options.perMessageDeflate);
      if (extensionOffer) {
        reqLines.push(`Sec-WebSocket-Extensions: ${extensionOffer}`);
      }
      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) {
          reqLines.push(`${k}: ${v}`);
        }
      }
      reqLines.push('', '');
      this._socket.write(reqLines.join('\r\n'));
    };

    if (this._secure && connectOpts.servername === undefined && net.isIP(host) === 0) {
      connectOpts.servername = host;
    }

    this._socket = this._secure
      ? tls.connect(connectOpts, onConnect)
      : net.connect(connectOpts, onConnect);

    this._socket.setNoDelay && this._socket.setNoDelay(true);
    this._handshakeBuf = Buffer.alloc(0);
    this._socket.on('data', (chunk) => this._onHandshakeData(chunk));
    this._socket.on('error', (err) => this._onEarlyError(err));
    this._socket.on('close', () => this._onEarlyClose());
  }

  get readyState() {
    return this._ws ? this._ws.readyState : this._readyState;
  }

  _onHandshakeData(chunk) {
    this._handshakeBuf = Buffer.concat([this._handshakeBuf, chunk]);
    const idx = this._handshakeBuf.indexOf('\r\n\r\n');
    if (idx < 0) {
      if (this._handshakeBuf.length > 16384) {
        this._abort('Handshake response too large');
      }
      return;
    }
    const headBlock = this._handshakeBuf.slice(0, idx).toString('latin1');
    const rest = this._handshakeBuf.slice(idx + 4);
    let parsed;
    try {
      parsed = parseHeaders(headBlock);
    } catch (e) {
      return this._abort(e.message);
    }

    if (parsed.statusCode !== 101) {
      return this._abort(`Unexpected response status ${parsed.statusCode}`);
    }
    if ((parsed.headers['upgrade'] || '').toLowerCase() !== 'websocket') {
      return this._abort('Missing/invalid Upgrade header');
    }
    if (!/\bupgrade\b/i.test(parsed.headers['connection'] || '')) {
      return this._abort('Missing Connection: Upgrade header');
    }
    if (parsed.headers['sec-websocket-accept'] !== this._expectedAccept) {
      return this._abort('Invalid Sec-WebSocket-Accept');
    }
    let acceptedExtensions;
    try {
      acceptedExtensions = parseAcceptedPerMessageDeflate(
        parsed.headers['sec-websocket-extensions'],
        this._perMessageDeflate,
      );
    } catch (e) {
      return this._abort(e.message);
    }
    if (parsed.headers['sec-websocket-extensions'] && !acceptedExtensions) {
      return this._abort('Unexpected Sec-WebSocket-Extensions');
    }
    const protocol = parsed.headers['sec-websocket-protocol'] || '';
    if (protocol && (!Array.isArray(this._protocols) || !this._protocols.includes(protocol))) {
      return this._abort('Unexpected Sec-WebSocket-Protocol');
    }

    // Detach handshake listeners; hand the socket off to the WebSocket.
    this._socket.removeAllListeners('data');
    this._socket.removeAllListeners('error');
    this._socket.removeAllListeners('close');

    this._readyState = OPEN;
    this._ws = new WebSocket(this._socket, {
      isServer: false,
      maxPayload: this._maxPayload,
      extensions: acceptedExtensions ? { perMessageDeflate: acceptedExtensions } : undefined,
      protocol,
      readyState: OPEN,
    });
    this.protocol = protocol;
    this.extensions = acceptedExtensions ? 'permessage-deflate' : '';
    // Forward events to the client wrapper.
    this._ws.on('message', (d, isBinary) => this.emit('message', d, isBinary));
    this._ws.on('ping', (d) => this.emit('ping', d));
    this._ws.on('pong', (d) => this.emit('pong', d));
    this._ws.on('close', (c, r) => this.emit('close', c, r));
    this._ws.on('error', (e) => this.emit('error', e));

    this.emit('upgrade', parsed);
    this.emit('open');

    // Feed leftover bytes (if any) into the frame parser.
    if (rest.length > 0) this._ws._onData(rest);

    // Flush any queued sends that happened before open.
    for (const entry of this._pendingQueue) this._ws.send(entry.data, entry.options, entry.cb);
    this._pendingQueue = [];
  }

  _onEarlyError(err) {
    this.emit('error', err);
  }

  _onEarlyClose() {
    if (!this._ws) {
      this._readyState = 3;
      this.emit('close', 1006, '');
    }
  }

  _abort(msg) {
    const err = new Error('WebSocket handshake failed: ' + msg);
    try { this._socket.destroy(); } catch {}
    this.emit('error', err);
    this._readyState = 3;
    this.emit('close', 1006, '');
  }

  send(data, options, cb) {
    if (this._ws) return this._ws.send(data, options, cb);
    this._pendingQueue.push({ data, options, cb });
  }

  ping(data, mask, cb) { if (this._ws) this._ws.ping(data, mask, cb); }
  pong(data, mask, cb) { if (this._ws) this._ws.pong(data, mask, cb); }

  close(code, reason) {
    if (code !== undefined && !isValidCloseCode(code)) {
      throw new RangeError(`Invalid close code: ${code}`);
    }
    if (this._ws) return this._ws.close(code, reason);
    try { this._socket.destroy(); } catch {}
  }

  terminate() {
    if (this._ws) return this._ws.terminate();
    try { this._socket.destroy(); } catch {}
  }
}

WebSocketClient.CONNECTING = 0;
WebSocketClient.OPEN = 1;
WebSocketClient.CLOSING = 2;
WebSocketClient.CLOSED = 3;

export { WebSocketClient };
