import { createApp } from './app.js';
import { logger } from './logger.js';
import { initFileStorage } from './services/story-store.js';

const port = parseInt(process.env.PORT || '5001', 10);

// Initialize file-based storage for production/dev
initFileStorage();

const app = createApp();

app.listen(port, () => {
  logger.info(`API server listening on http://localhost:${port}`);
});
