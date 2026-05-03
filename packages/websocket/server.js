import { EventEmitter } from 'node:events';
import http from 'node:http';
import https from 'node:https';
import native from './native.js';
import {
  acceptPerMessageDeflate,
  chooseSubprotocol,
} from './extensions.js';
import { WebSocket, OPEN } from './websocket.js';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function computeAccept(key) {
  return native.computeAcceptKey(key);
}

// Abort the upgrade with a canned HTTP error response.
function abortUpgrade(socket, status, message) {
  try {
    const body = message ? message : http.STATUS_CODES[status] || '';
    const head =
      `HTTP/1.1 ${status} ${http.STATUS_CODES[status] || 'Error'}\r\n` +
      'Connection: close\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      'Content-Type: text/plain\r\n\r\n';
    socket.write(head + body);
  } catch { /* noop */ }
  try { socket.destroy(); } catch { /* noop */ }
}

function getTlsOptions(options) {
  const keys = [
    'ALPNProtocols',
    'SNICallback',
    'ca',
    'cert',
    'ciphers',
    'clientCertEngine',
    'crl',
    'dhparam',
    'ecdhCurve',
    'honorCipherOrder',
    'key',
    'maxVersion',
    'minVersion',
    'passphrase',
    'pfx',
    'privateKeyEngine',
    'privateKeyIdentifier',
    'requestCert',
    'rejectUnauthorized',
    'secureOptions',
    'secureProtocol',
    'sessionIdContext',
    'sigalgs',
    'ticketKeys',
  ];
  const tlsOptions = {};
  for (const key of keys) {
    if (options[key] !== undefined) tlsOptions[key] = options[key];
  }
  if (options.tls && typeof options.tls === 'object') {
    Object.assign(tlsOptions, options.tls);
  }
  return tlsOptions;
}

class WebSocketServer extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.options = {
      port: options.port,
      host: options.host,
      server: options.server,
      noServer: !!options.noServer,
      path: options.path,
      maxPayload: options.maxPayload,
      verifyClient: options.verifyClient,
      protocols: options.protocols,
      perMessageDeflate: options.perMessageDeflate,
      backlog: options.backlog,
      tls: options.tls,
    };
    const tlsOptions = getTlsOptions(options);
    this.options.tls = Object.keys(tlsOptions).length > 0 ? tlsOptions : undefined;
    this.clients = new Set();
    this._server = null; // internal http.Server (if we own it)
    this._externalServer = null;
    this._upgradeHandler = null;

    if (this.options.noServer) {
      // Just provide handleUpgrade; user is responsible for routing.
      return;
    }

    if (this.options.server) {
      this._externalServer = this.options.server;
      this._attachToServer(this._externalServer);
    } else if (this.options.port !== undefined) {
      const requestHandler = (req, res) => {
        // Non-WebSocket HTTP hits on the standalone port get a 426.
        const body = http.STATUS_CODES[426];
        res.writeHead(426, {
          'Content-Length': Buffer.byteLength(body),
          'Content-Type': 'text/plain',
        });
        res.end(body);
      };
      this._server = this.options.tls
        ? https.createServer(this.options.tls, requestHandler)
        : http.createServer(requestHandler);
      this._attachToServer(this._server);
      this._server.listen(
        this.options.port,
        this.options.host,
        this.options.backlog,
        () => this.emit('listening'),
      );
      this._server.on('error', (err) => this.emit('error', err));
    } else {
      throw new Error('WebSocketServer requires { port } or { server } or { noServer: true }');
    }
  }

  address() {
    if (this._server) return this._server.address();
    if (this._externalServer && this._externalServer.address) return this._externalServer.address();
    return null;
  }

  _attachToServer(server) {
    const handler = (req, socket, head) => {
      // If a path is configured, filter on it.
      if (this.options.path) {
        const urlPath = req.url.split('?')[0];
        if (urlPath !== this.options.path) {
          // Let other upgrade listeners handle it; if none, abort.
          if (server.listenerCount('upgrade') === 1) {
            abortUpgrade(socket, 400, 'Bad path for WebSocket');
          }
          return;
        }
      }
      this.handleUpgrade(req, socket, head, (ws) => {
        this.emit('connection', ws, req);
      });
    };
    this._upgradeHandler = handler;
    server.on('upgrade', handler);
  }

  // Perform the RFC 6455 handshake on an already-produced upgrade request.
  // Accepts the same argument shape as `ws` for drop-in compatibility.
  handleUpgrade(request, socket, head, cb) {
    const upgrade = (request.headers['upgrade'] || '').toLowerCase();
    const connection = (request.headers['connection'] || '').toLowerCase();
    const version = request.headers['sec-websocket-version'];
    const key = request.headers['sec-websocket-key'];

    if (request.method !== 'GET') return abortUpgrade(socket, 405, 'Method not allowed');
    if (upgrade !== 'websocket') return abortUpgrade(socket, 400, 'Upgrade header must be websocket');
    if (!/\bupgrade\b/i.test(connection)) return abortUpgrade(socket, 400, 'Connection header must contain "upgrade"');
    if (version !== '13') {
      try {
        socket.write(
          'HTTP/1.1 426 Upgrade Required\r\n' +
          'Sec-WebSocket-Version: 13\r\n' +
          'Connection: close\r\n\r\n');
      } catch {}
      try { socket.destroy(); } catch {}
      return;
    }
    if (!key || !/^[+/0-9A-Za-z]{22}==$/.test(key)) {
      return abortUpgrade(socket, 400, 'Invalid Sec-WebSocket-Key');
    }

    const doAccept = () => {
      const accept = computeAccept(key);
      const extension = acceptPerMessageDeflate(
        request.headers['sec-websocket-extensions'],
        this.options.perMessageDeflate,
      );
      const protocol = chooseSubprotocol(
        request.headers['sec-websocket-protocol'],
        this.options.protocols,
      );
      const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
      ];
      if (extension) responseHeaders.push(`Sec-WebSocket-Extensions: ${extension.header}`);
      if (protocol) responseHeaders.push(`Sec-WebSocket-Protocol: ${protocol}`);
      try {
        socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
      } catch (err) {
        try { socket.destroy(); } catch {}
        return;
      }

      // Disable Nagle for lower latency (typical WS guidance).
      if (socket.setTimeout) socket.setTimeout(0);
      if (socket.setNoDelay) socket.setNoDelay(true);

      const ws = new WebSocket(socket, {
        isServer: true,
        maxPayload: this.options.maxPayload,
        extensions: extension ? { perMessageDeflate: extension.options } : undefined,
        protocol,
        readyState: OPEN,
      });
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));

      // If `head` contained bytes past the HTTP request (unusual for most
      // clients but possible), feed them into the parser now.
      if (head && head.length > 0) ws._onData(head);

      cb(ws, request);
    };

    if (typeof this.options.verifyClient === 'function') {
      const info = { origin: request.headers['origin'], secure: !!(socket.encrypted), req: request };
      if (this.options.verifyClient.length >= 2) {
        // Async style: (info, cb)
        this.options.verifyClient(info, (allow, code, message, headers) => {
          if (!allow) return abortUpgrade(socket, code || 401, message);
          doAccept();
        });
      } else {
        const allow = this.options.verifyClient(info);
        if (!allow) return abortUpgrade(socket, 401, 'Unauthorized');
        doAccept();
      }
    } else {
      doAccept();
    }
  }

  close(cb) {
    // Stop accepting new upgrades and close our owned server (if any).
    if (this._externalServer && this._upgradeHandler) {
      this._externalServer.removeListener('upgrade', this._upgradeHandler);
      this._upgradeHandler = null;
    }
    // Initiate a graceful close on all live clients.
    for (const ws of this.clients) {
      try { ws.close(1001, 'Server shutting down'); } catch {}
    }
    if (this._server) {
      this._server.close((err) => cb && cb(err));
    } else if (cb) {
      setImmediate(cb);
    }
  }
}

export { WebSocketServer };
