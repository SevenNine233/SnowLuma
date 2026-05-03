import { WebSocket as InternalWebSocket } from './websocket.js';
import { WebSocketServer } from './server.js';
import { WebSocketClient } from './client.js';
import native from './native.js';

WebSocketClient.Server = WebSocketServer;

const WebSocket = WebSocketClient;
const Server = WebSocketServer;
const _internal = { WebSocket: InternalWebSocket, native };

export {
  WebSocket,
  WebSocketServer,
  Server,
  _internal,
};

export default {
  WebSocket,
  WebSocketServer,
  Server,
  _internal,
};
