import { type Express, type Request, type Response } from 'express';
import {
  getSession,
  getAllSessions,
  getSessionMessages,
  endSession as endSessionStore,
} from '../services/story-store.js';
import {
  startNewSession,
  handleConversationTurn,
  generateSessionSummary,
  getLastSessionSummary,
} from '../services/story-orchestrator.js';

const MAX_MESSAGE_LENGTH = 10000;

export function mapStoryEndpoints(app: Express): void {
  // POST /api/stories/sessions — create a new session with AI welcome
  app.post('/api/stories/sessions', async (_req: Request, res: Response) => {
    try {
      const { sessionId, welcomeMessage } = await startNewSession();
      const session = getSession(sessionId);
      res.status(201).json({
        session,
        welcomeMessage,
      });
    } catch {
      res.status(503).json({ error: 'AI service is currently unavailable. Please try again.' });
    }
  });

  // GET /api/stories/sessions — list all sessions with pagination
  app.get('/api/stories/sessions', (req: Request, res: Response) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const allSessions = getAllSessions();
    const total = allSessions.length;
    const paginated = allSessions.slice(offset, offset + limit);

    res.json({ sessions: paginated, total, limit, offset });
  });

  // GET /api/stories/sessions/:id — get a single session
  app.get('/api/stories/sessions/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ session });
  });

  // GET /api/stories/sessions/:id/messages — get messages for a session
  app.get('/api/stories/sessions/:id/messages', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const messages = getSessionMessages(id);
    res.json({ messages });
  });

  // POST /api/stories/sessions/:id/messages — send a message
  app.post('/api/stories/sessions/:id/messages', async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const session = getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status === 'ended') {
      res.status(409).json({ error: 'Cannot send messages to an ended session' });
      return;
    }

    const { message } = req.body as { message?: string };
    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: 'Message must not exceed 10000 characters' });
      return;
    }

    try {
      const trimmed = message.trim();

      // handleConversationTurn stores both messages and returns the assistant response
      const assistantContent = await handleConversationTurn(id, trimmed);

      // Get the last two messages (user + assistant)
      const allMessages = getSessionMessages(id);
      const userMessage = allMessages[allMessages.length - 2];
      const assistantMessage = allMessages[allMessages.length - 1];

      // Verify we got both messages
      if (!userMessage || !assistantMessage) {
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      void assistantContent;
      res.json({ userMessage, assistantMessage });
    } catch {
      res.status(503).json({ error: 'AI service is currently unavailable. Please try again.' });
    }
  });

  // POST /api/stories/sessions/:id/end — end a session
  app.post('/api/stories/sessions/:id/end', async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const session = getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status === 'ended') {
      res.status(409).json({ error: 'Session is already ended' });
      return;
    }

    try {
      const summary = await generateSessionSummary(id);
      const ended = endSessionStore(id, summary);
      res.json({ session: ended });
    } catch {
      // End session even if summary generation fails
      const ended = endSessionStore(id, null);
      res.status(503).json({
        error: 'Session ended but summary generation failed. It will be retried.',
        session: ended,
      });
    }
  });

  // GET /api/stories/last-summary — get last session summary (for frontend)
  app.get('/api/stories/last-summary', (_req: Request, res: Response) => {
    const summary = getLastSessionSummary();
    res.json({ summary });
  });
}
