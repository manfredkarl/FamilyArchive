import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import WebSocketModule from 'ws';
import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../logger.js';

const VOICELIVE_ENDPOINT = process.env.AZURE_VOICELIVE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || '';
const VOICELIVE_MODEL = process.env.AZURE_VOICELIVE_MODEL || 'gpt-4o';
const API_VERSION = '2025-10-01';

const credential = new DefaultAzureCredential();

export function setupVoiceWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/api/voice' });

  wss.on('connection', async (browserWs: WebSocket) => {
    logger.info('Voice WebSocket: browser connected');

    if (!VOICELIVE_ENDPOINT) {
      browserWs.send(JSON.stringify({ type: 'error', message: 'VoiceLive endpoint not configured' }));
      browserWs.close();
      return;
    }

    try {
      // Get Azure token
      const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
      const host = VOICELIVE_ENDPOINT.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const vlUrl = `wss://${host}/voice-live/realtime?api-version=${API_VERSION}&model=${encodeURIComponent(VOICELIVE_MODEL)}`;

      // Connect to VoiceLive with auth header
      const vlWs = new WebSocketModule(vlUrl, {
        headers: { Authorization: `Bearer ${tokenResponse.token}` },
      });

      let vlConnected = false;

      vlWs.on('open', () => {
        vlConnected = true;
        logger.info('Voice WebSocket: connected to VoiceLive');
      });

      // Relay: VoiceLive → Browser (raw frames, no parsing)
      vlWs.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
        if (browserWs.readyState === WebSocket.OPEN) {
          try {
            if (isBinary) {
              browserWs.send(data, { binary: true });
            } else {
              browserWs.send(data, { binary: false });
            }
          } catch {
            // ignore send errors
          }
        }
      });

      // Relay: Browser → VoiceLive (raw frames, no parsing)
      browserWs.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
        if (vlConnected && vlWs.readyState === WebSocket.OPEN) {
          try {
            if (isBinary) {
              vlWs.send(data, { binary: true });
            } else {
              vlWs.send(data, { binary: false });
            }
          } catch {
            // ignore send errors
          }
        }
      });

      // Cleanup on either side closing
      vlWs.on('close', () => {
        logger.info('Voice WebSocket: VoiceLive disconnected');
        if (browserWs.readyState === WebSocket.OPEN) browserWs.close();
      });

      vlWs.on('error', (err: Error) => {
        logger.error({ err: err.message }, 'Voice WebSocket: VoiceLive error');
        if (browserWs.readyState === WebSocket.OPEN) {
          browserWs.send(JSON.stringify({ type: 'error', message: err.message }));
          browserWs.close();
        }
      });

      browserWs.on('close', () => {
        logger.info('Voice WebSocket: browser disconnected');
        if (vlWs.readyState === WebSocket.OPEN) vlWs.close();
      });

      browserWs.on('error', () => {
        if (vlWs.readyState === WebSocket.OPEN) vlWs.close();
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, 'Voice WebSocket: setup failed');
      browserWs.send(JSON.stringify({ type: 'error', message: msg }));
      browserWs.close();
    }
  });

  logger.info('Voice WebSocket relay registered at /api/voice');
}
