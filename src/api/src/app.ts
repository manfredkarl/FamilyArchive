import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';
import { mapHealthEndpoints } from './routes/health.js';
import { mapChatEndpoints } from './routes/chat.js';

export function createApp(): express.Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Routes
  mapHealthEndpoints(app);
  mapChatEndpoints(app);

  return app;
}
