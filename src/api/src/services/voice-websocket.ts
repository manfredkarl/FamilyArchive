import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../logger.js';

export function setupVoiceWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/api/voice' });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('Voice WebSocket connection established');

    // Send stub error message immediately
    const stubMessage = JSON.stringify({
      type: 'error',
      message: 'Voice WebSocket is not yet implemented. Please use the REST API with browser speech.',
    });
    ws.send(stubMessage);

    // Also respond to any incoming message with the stub
    ws.on('message', () => {
      ws.send(stubMessage);
    });

    ws.on('close', () => {
      logger.info('Voice WebSocket connection closed');
    });
  });

  logger.info('Voice WebSocket endpoint registered at /api/voice');
}
