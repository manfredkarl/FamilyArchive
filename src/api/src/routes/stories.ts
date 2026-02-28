import { type Express, type Request, type Response } from 'express';
import { createSession, getSession, getAllSessions, addMessage } from '../services/story-store.js';

const WELCOME_MESSAGE = 'Willkommen! Ich freue mich, dass Sie da sind. Erzählen Sie mir eine Geschichte aus Ihrem Leben.';

export function mapStoryEndpoints(app: Express): void {
  // POST /api/stories/sessions — create a new session
  app.post('/api/stories/sessions', (_req: Request, res: Response) => {
    const session = createSession();
    // Add welcome message as first assistant message
    addMessage(session.id, 'assistant', WELCOME_MESSAGE);
    res.status(201).json({
      session,
      welcomeMessage: WELCOME_MESSAGE,
    });
  });

  // GET /api/stories/sessions — list all sessions
  app.get('/api/stories/sessions', (_req: Request, res: Response) => {
    const sessions = getAllSessions();
    res.json({ sessions, total: sessions.length });
  });

  // POST /api/stories/sessions/:id/messages — send a message
  app.post('/api/stories/sessions/:id/messages', (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const session = getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const { message } = req.body as { message?: string };
    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const userMessage = addMessage(id, 'user', message.trim());
    const assistantMessage = addMessage(id, 'assistant', `Echo: ${message.trim()}`);

    res.json({ userMessage, assistantMessage });
  });
}
