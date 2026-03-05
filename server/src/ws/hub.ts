import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { appStore } from '../shared/store.js';
import type { WsEnvelope } from '../types/domain.js';
import { logger } from '../config/logger.js';

function send(ws: WebSocket, payload: WsEnvelope): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify(payload));
}

export function setupWsHub(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    logger.info('WS client connected');

    send(socket, {
      channel: 'engine.state',
      ts: Date.now(),
      data: { state: appStore.getEngineState() },
    });

    send(socket, {
      channel: 'markets.ticker',
      ts: Date.now(),
      data: appStore.getMarkets({ page: 1, pageSize: 100 }).items,
    });

    socket.on('close', () => {
      logger.info('WS client disconnected');
    });

    socket.on('error', (err) => {
      logger.warn({ err }, 'WS client error');
    });
  });

  appStore.on('ws:event', (event: WsEnvelope) => {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  return wss;
}
