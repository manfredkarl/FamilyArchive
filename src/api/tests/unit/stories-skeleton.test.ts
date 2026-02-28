import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { clearStoryStore } from '../../src/services/story-store.js';

describe('Stories Walking Skeleton', () => {
  const app = createApp();

  beforeEach(() => {
    clearStoryStore();
  });

  // AC 1: Health endpoint
  describe('GET /api/health', () => {
    it('should return { status: "ok" } with HTTP 200', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  // AC 2: Session creation
  describe('POST /api/stories/sessions', () => {
    it('should return 201 with session object and welcome message', async () => {
      const res = await request(app).post('/api/stories/sessions');
      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.id).toBeDefined();
      expect(res.body.session.startedAt).toBeDefined();
      expect(res.body.session.status).toBe('active');
      expect(res.body.session.messageCount).toBe(1);
      expect(res.body.welcomeMessage).toBeDefined();
      expect(typeof res.body.welcomeMessage).toBe('string');
      expect(res.body.welcomeMessage.length).toBeGreaterThan(0);
    });
  });

  // AC 3: Message response (fallback mode — no echo, warm German response)
  describe('POST /api/stories/sessions/:id/messages', () => {
    it('should return user message and assistant response', async () => {
      // First create a session
      const sessionRes = await request(app).post('/api/stories/sessions');
      const sessionId = sessionRes.body.session.id;

      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.userMessage).toBeDefined();
      expect(res.body.userMessage.content).toBe('Hello');
      expect(res.body.userMessage.role).toBe('user');
      expect(res.body.userMessage.sessionId).toBe(sessionId);
      expect(res.body.assistantMessage).toBeDefined();
      expect(res.body.assistantMessage.content.length).toBeGreaterThan(0);
      expect(res.body.assistantMessage.role).toBe('assistant');
      expect(res.body.assistantMessage.sessionId).toBe(sessionId);
    });
  });

  // AC 4: Empty message validation
  describe('POST /api/stories/sessions/:id/messages — empty message', () => {
    it('should return 400 when message is empty', async () => {
      const sessionRes = await request(app).post('/api/stories/sessions');
      const sessionId = sessionRes.body.session.id;

      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message is required');
    });

    it('should return 400 when message is missing', async () => {
      const sessionRes = await request(app).post('/api/stories/sessions');
      const sessionId = sessionRes.body.session.id;

      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message is required');
    });

    it('should return 400 when message is whitespace only', async () => {
      const sessionRes = await request(app).post('/api/stories/sessions');
      const sessionId = sessionRes.body.session.id;

      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message is required');
    });
  });

  // AC 5: Non-existent session
  describe('POST /api/stories/sessions/:id/messages — non-existent session', () => {
    it('should return 404 for non-existent session', async () => {
      const res = await request(app)
        .post('/api/stories/sessions/nonexistent/messages')
        .send({ message: 'Hello' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });

  // Additional: GET /api/stories/sessions (list sessions)
  describe('GET /api/stories/sessions', () => {
    it('should return empty list when no sessions exist', async () => {
      const res = await request(app).get('/api/stories/sessions');
      expect(res.status).toBe(200);
      expect(res.body.sessions).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should return sessions after creation', async () => {
      await request(app).post('/api/stories/sessions');
      const res = await request(app).get('/api/stories/sessions');
      expect(res.status).toBe(200);
      expect(res.body.sessions.length).toBe(1);
      expect(res.body.total).toBe(1);
    });
  });
});
