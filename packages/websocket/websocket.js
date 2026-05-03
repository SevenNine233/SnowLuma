import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import native from './native.js';
import { compressRaw, decompressRaw } from './extensions.js';

// RFC 6455 opcodes.
const OP_CONT = 0x0;
const OP_TEXT = 0x1;
const OP_BIN = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xA;
const RSV1 = 0x40;

// Ready states (mirror the standard WebSocket API numbers).
const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

// Default cap per-message and per-frame.
const DEFAULT_MAX_PAYLOAD = 100 * 1024 * 1024;

function isValidCloseCode(code) {
  if (code === 1000 || code === 1001 || code === 1002 || code === 1003 ||
      code === 1007 || code === 1008 || code === 1009 || code === 1010 ||
      code === 1011) {
    return true;
  }
  if (code >= 3000 && code <= 4999) return true;
  return false;
}

function encodeClosePayload(code, reason) {
  const reasonBuf = reason ? Buffer.from(String(reason), 'utf8') : Buffer.alloc(0);
  if (code === undefined || code === null) {
    if (reasonBuf.length > 0) {
      throw new Error('Cannot send close reason without a code');
    }
    return Buffer.alloc(0);
  }
  const buf = Buffer.allocUnsafe(2 + reasonBuf.length);
  buf.writeUInt16BE(code & 0xFFFF, 0);
  reasonBuf.copy(buf, 2);
  return buf;
}

// Streaming UTF-8 validator used while a text message is being received in
// fragments. Returns { ok, done } after appending a chunk; `done` means the
// message ended on a code-point boundary.
class Utf8Validator {
  constructor() {
    this.state = 0; // bytes still expected in current code point
    this.codepoint = 0;
    this.minNext = 0; // for overlong / surrogate range validation
  }

  push(buf) {
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (this.state === 0) {
        if ((b & 0x80) === 0) continue;
        if ((b & 0xE0) === 0xC0) {
          if (b < 0xC2) return false; // overlong
          this.codepoint = b & 0x1F;
          this.state = 1;
          this.minNext = 0x80;
        } else if ((b & 0xF0) === 0xE0) {
          this.codepoint = b & 0x0F;
          this.state = 2;
          this.minNext = (b === 0xE0) ? 0xA0 : 0x80;
        } else if ((b & 0xF8) === 0xF0) {
          if (b > 0xF4) return false;
          this.codepoint = b & 0x07;
          this.state = 3;
          this.minNext = (b === 0xF0) ? 0x90 : 0x80;
        } else {
          return false;
        }
      } else {
        if (b < this.minNext || b > 0xBF) return false;
        // Reject UTF-16 surrogates encoded as 3-byte sequences (ED A0..BF ..).
        if (this.state === 2 && this.codepoint === 0xD && (b & 0x20)) {
          // Actually this branch is unreachable because minNext would be 0x80
          // and for codepoint starting 0xED (codepoint==0xD) minNext above is
          // 0x80 already so any A0..BF passes. We explicitly reject here.
          return false;
        }
        if (this.codepoint === 0xD && this.state === 2 && b >= 0xA0) {
          return false;
        }
        this.codepoint = (this.codepoint << 6) | (b & 0x3F);
        this.state--;
        this.minNext = 0x80;
      }
    }
    return true;
  }

  done() {
    return this.state === 0;
  }
}

function randomMaskKey() {
  const b = Buffer.allocUnsafe(4);
  // crypto.randomFillSync is slightly faster than randomBytes for small sizes.
  crypto.randomFillSync(b);
  return b;
}

// Shared WebSocket connection handling logic. Used by both server- and
// client-side after a successful handshake.
class WebSocket extends EventEmitter {
  constructor(socket, options) {
    super();
    options = options || {};
    this._socket = socket;
    this._isServer = !!options.isServer;
    this._maxPayload = options.maxPayload ?? DEFAULT_MAX_PAYLOAD;
    this._readyState = options.readyState ?? OPEN;
    this._perMessageDeflate = options.extensions && options.extensions.perMessageDeflate;
    this.protocol = options.protocol || '';
    this.extensions = this._perMessageDeflate ? 'permessage-deflate' : '';

    this._parser = new native.Parser({
      isServer: this._isServer, // server expects masked frames from clients
      maxPayload: this._maxPayload,
      allowedRsv: this._perMessageDeflate ? RSV1 : 0,
    });

    // Fragmented message assembly state.
    this._msgOpcode = 0;
    this._msgChunks = [];
    this._msgSize = 0;
    this._msgValidator = null;
    this._msgCompressed = false;

    // Close state.
    this._closeCodeSent = null;
    this._closeCodeReceived = null;
    this._closeReasonReceived = '';
    this._closeFrameSent = false;
    this._closeTimer = null;

    this._bindSocket();
  }

  get readyState() { return this._readyState; }
  get isServer() { return this._isServer; }

  _bindSocket() {
    const sock = this._socket;
    sock.on('data', (chunk) => this._onData(chunk));
    sock.on('end', () => this._onEnd());
    sock.on('close', () => this._onSocketClose());
    sock.on('error', (err) => this._onError(err));
  }

  _onData(chunk) {
    if (this._readyState === CLOSED) return;
    const res = this._parser.push(chunk);
    if (res.error) {
      this._failConnection(res.code || 1002, res.message || 'Protocol error');
      return;
    }
    for (const f of res.frames) {
      this._handleFrame(f);
      if (this._readyState === CLOSED) return;
    }
  }

  _onEnd() {
    // Peer gracefully half-closed without a Close frame.
    if (this._readyState !== CLOSED) {
      // If we never received a Close, treat as abnormal.
      if (this._closeCodeReceived === null) {
        this._closeCodeReceived = 1006;
        this._closeReasonReceived = '';
      }
      this._destroySocket();
    }
  }

  _onSocketClose() {
    if (this._readyState === CLOSED) return;
    if (this._closeCodeReceived === null) {
      this._closeCodeReceived = 1006;
    }
    this._readyState = CLOSED;
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
    this.emit('close', this._closeCodeReceived, this._closeReasonReceived);
  }

  _onError(err) {
    this.emit('error', err);
  }

  _handleFrame(f) {
    const { fin, opcode, payload, rsv = 0 } = f;
    if (opcode === OP_PING) {
      this.emit('ping', payload);
      if (this._readyState === OPEN) this._sendControl(OP_PONG, payload);
      return;
    }
    if (opcode === OP_PONG) {
      this.emit('pong', payload);
      return;
    }
    if (opcode === OP_CLOSE) {
      this._handleCloseFrame(payload);
      return;
    }

    // Data frames (TEXT / BIN / CONT).
    if (opcode === OP_TEXT || opcode === OP_BIN) {
      if (this._msgOpcode !== 0) {
        this._failConnection(1002, 'New data frame started before previous fragmented message finished');
        return;
      }
      if ((rsv & RSV1) && !this._perMessageDeflate) {
        this._failConnection(1002, 'Compressed frame without negotiated permessage-deflate');
        return;
      }
      this._msgOpcode = opcode;
      this._msgChunks = [];
      this._msgSize = 0;
      this._msgCompressed = (rsv & RSV1) !== 0;
      if (opcode === OP_TEXT) this._msgValidator = new Utf8Validator();
      else this._msgValidator = null;
    } else if (opcode === OP_CONT) {
      if (this._msgOpcode === 0) {
        this._failConnection(1002, 'Continuation frame without active message');
        return;
      }
      if (rsv !== 0) {
        this._failConnection(1002, 'RSV bits set on continuation frame');
        return;
      }
    }

    this._msgSize += payload.length;
    if (this._msgSize > this._maxPayload) {
      this._failConnection(1009, 'Message too large');
      return;
    }
    if (payload.length > 0) this._msgChunks.push(payload);

    if (fin) {
      let data = this._msgChunks.length === 1
        ? this._msgChunks[0]
        : Buffer.concat(this._msgChunks, this._msgSize);
      if (this._msgCompressed) {
        try {
          data = decompressRaw(data, this._maxPayload);
        } catch (err) {
          this._failConnection(err.code || 1007, err.message || 'Invalid compressed payload');
          return;
        }
      }
      if (this._msgValidator) {
        if (!this._msgValidator.push(data) || !this._msgValidator.done()) {
          this._failConnection(1007, 'Invalid UTF-8');
          return;
        }
      }
      const isBinary = this._msgOpcode === OP_BIN;
      this._msgOpcode = 0;
      this._msgChunks = [];
      this._msgSize = 0;
      this._msgValidator = null;
      this._msgCompressed = false;
      this.emit('message', data, isBinary);
    }
  }

  _handleCloseFrame(payload) {
    let code = 1005;
    let reason = '';
    if (payload.length === 1) {
      return this._failConnection(1002, 'Close payload length 1');
    }
    if (payload.length >= 2) {
      code = payload.readUInt16BE(0);
      if (!isValidCloseCode(code)) {
        return this._failConnection(1002, 'Invalid close code');
      }
      if (payload.length > 2) {
        try {
          reason = new TextDecoder('utf-8', { fatal: true }).decode(payload.subarray(2));
        } catch {
          return this._failConnection(1007, 'Invalid UTF-8 in close reason');
        }
      }
    }
    this._closeCodeReceived = code;
    this._closeReasonReceived = reason;

    if (this._readyState === OPEN) {
      // Echo a close frame back with same code (per RFC 6455 §5.5.1).
      this._readyState = CLOSING;
      const echo = encodeClosePayload(code === 1005 ? undefined : code, '');
      this._sendControl(OP_CLOSE, echo);
      this._closeFrameSent = true;
      this._endSocketSoon();
    } else if (this._readyState === CLOSING) {
      // We already sent our close frame; the handshake is complete.
      this._endSocketSoon();
    }
  }

  _endSocketSoon() {
    // Flush pending writes then half-close. Give the peer a moment to close.
    try { this._socket.end(); } catch { /* noop */ }
    if (this._closeTimer) clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => this._destroySocket(), 30000);
    this._closeTimer.unref && this._closeTimer.unref();
  }

  _destroySocket() {
    try { this._socket.destroy(); } catch { /* noop */ }
  }

  _failConnection(code, reason) {
    if (this._readyState === CLOSED) return;
    const payload = encodeClosePayload(code, reason);
    let frame = null;
    try {
      frame = native.buildFrame(OP_CLOSE, true, payload,
        this._isServer ? null : randomMaskKey(), 0);
    } catch { /* noop */ }
    this._closeCodeSent = code;
    this._readyState = CLOSING;
    const err = new Error(`WebSocket protocol error: ${reason}`);
    err.code = code;
    this.emit('error', err);
    // Use `end(frame)` so the close frame flushes and a FIN is sent. This
    // yields a clean TCP half-close peers can observe via the 'end' event.
    try {
      if (frame) this._socket.end(frame);
      else this._socket.end();
    } catch { /* noop */ }
    // Failsafe: destroy if the peer never FIN's back.
    if (this._closeTimer) clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => this._destroySocket(), 2000);
    this._closeTimer.unref && this._closeTimer.unref();
  }

  _sendControl(opcode, payload) {
    if (!payload) payload = Buffer.alloc(0);
    const frame = native.buildFrame(opcode, true, payload, this._isServer ? null : randomMaskKey(), 0);
    this._socket.write(frame);
  }

  // Public API -------------------------------------------------------------

  send(data, options, cb) {
    if (typeof options === 'function') { cb = options; options = undefined; }
    options = options || {};
    if (this._readyState !== OPEN) {
      const err = new Error('WebSocket is not open');
      if (cb) return cb(err);
      throw err;
    }
    let payload;
    let opcode;
    if (typeof data === 'string') {
      payload = Buffer.from(data, 'utf8');
      opcode = options.binary ? OP_BIN : OP_TEXT;
    } else if (Buffer.isBuffer(data)) {
      payload = data;
      opcode = options.binary === false ? OP_TEXT : OP_BIN;
    } else if (data instanceof Uint8Array) {
      payload = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      opcode = options.binary === false ? OP_TEXT : OP_BIN;
    } else if (data instanceof ArrayBuffer) {
      payload = Buffer.from(data);
      opcode = options.binary === false ? OP_TEXT : OP_BIN;
    } else {
      const err = new TypeError('Unsupported data type for send()');
      if (cb) return cb(err);
      throw err;
    }
    let rsv = 0;
    if (this._perMessageDeflate && options.compress !== false &&
        payload.length >= (this._perMessageDeflate.threshold ?? 1024)) {
      payload = compressRaw(payload);
      rsv = RSV1;
    }
    const maskKey = this._isServer ? null : randomMaskKey();
    const frame = native.buildFrame(opcode, true, payload, maskKey, rsv);
    this._socket.write(frame, cb);
  }

  ping(data, mask, cb) {
    if (typeof data === 'function') { cb = data; data = undefined; mask = undefined; }
    if (typeof mask === 'function') { cb = mask; mask = undefined; }
    const payload = data ? (Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')) : Buffer.alloc(0);
    if (payload.length > 125) throw new Error('Ping payload must be <=125 bytes');
    if (this._readyState !== OPEN) {
      const err = new Error('WebSocket is not open');
      if (cb) return cb(err);
      throw err;
    }
    const maskKey = this._isServer ? null : randomMaskKey();
    const frame = native.buildFrame(OP_PING, true, payload, maskKey, 0);
    this._socket.write(frame, cb);
  }

  pong(data, mask, cb) {
    if (typeof data === 'function') { cb = data; data = undefined; mask = undefined; }
    if (typeof mask === 'function') { cb = mask; mask = undefined; }
    const payload = data ? (Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')) : Buffer.alloc(0);
    if (payload.length > 125) throw new Error('Pong payload must be <=125 bytes');
    if (this._readyState !== OPEN) {
      const err = new Error('WebSocket is not open');
      if (cb) return cb(err);
      throw err;
    }
    const maskKey = this._isServer ? null : randomMaskKey();
    const frame = native.buildFrame(OP_PONG, true, payload, maskKey, 0);
    this._socket.write(frame, cb);
  }

  close(code, reason) {
    if (this._readyState === CLOSED || this._readyState === CLOSING) return;
    if (code !== undefined && !isValidCloseCode(code)) {
      throw new RangeError(`Invalid close code: ${code}`);
    }
    const reasonBuf = reason ? Buffer.from(String(reason), 'utf8') : Buffer.alloc(0);
    if (reasonBuf.length > 123) throw new RangeError('Close reason must be <=123 bytes');
    const payload = encodeClosePayload(code, reason);
    const maskKey = this._isServer ? null : randomMaskKey();
    const frame = native.buildFrame(OP_CLOSE, true, payload, maskKey, 0);
    this._readyState = CLOSING;
    this._closeCodeSent = code ?? null;
    this._socket.write(frame);
    this._closeFrameSent = true;
    this._endSocketSoon();
  }

  terminate() {
    this._readyState = CLOSING;
    this._destroySocket();
  }
}

WebSocket.CONNECTING = CONNECTING;
WebSocket.OPEN = OPEN;
WebSocket.CLOSING = CLOSING;
WebSocket.CLOSED = CLOSED;

export {
  WebSocket,
  CONNECTING, OPEN, CLOSING, CLOSED,
  OP_CONT, OP_TEXT, OP_BIN, OP_CLOSE, OP_PING, OP_PONG,
  RSV1,
  isValidCloseCode,
  encodeClosePayload,
  randomMaskKey,
};
