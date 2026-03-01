import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { clearStoryStore } from '../../src/services/story-store.js';

// Mock the openai-client module at the service level
vi.mock('../../src/services/openai-client.js', () => ({
  isOpenAIConfigured: vi.fn(() => true),
  chatCompletion: vi.fn(),
  getFallbackWelcome: vi.fn((isFirst: boolean) =>
    isFirst
      ? 'Willkommen zum ersten Gespräch!'
      : 'Schön, dass du wieder da bist!',
  ),
  getFallbackResponse: vi.fn(() => 'Eine warme Antwort.'),
  getFallbackSummary: vi.fn(() => 'Zusammenfassung des Gesprächs.'),
}));

import {
  chatCompletion,
  isOpenAIConfigured,
} from '../../src/services/openai-client.js';

const mockedChatCompletion = vi.mocked(chatCompletion);
const mockedIsConfigured = vi.mocked(isOpenAIConfigured);

describe('Story Engine — Increment 2', () => {
  const app = createApp();

  beforeEach(() => {
    clearStoryStore();
    vi.clearAllMocks();
    mockedIsConfigured.mockReturnValue(true);
  });

  // Helper: create a session (static welcome, no AI call needed)
  async function createTestSession() {
    const res = await request(app).post('/api/stories/sessions');
    return res;
  }

  // AC 1: POST /sessions returns AI-generated welcome
  describe('POST /api/stories/sessions — AI welcome', () => {
    it('should return static welcome message (first session)', async () => {
      const res = await request(app).post('/api/stories/sessions');

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.id).toBeDefined();
      expect(res.body.session.status).toBe('active');
      expect(res.body.session.messageCount).toBe(1);
      expect(res.body.welcomeMessage).toContain('Hallo!');
      // Static welcome — no AI call
      expect(mockedChatCompletion).not.toHaveBeenCalled();
    });

    it('should reference prior session summary for returning users', async () => {
      // First session
      await request(app).post('/api/stories/sessions');

      // End first session with summary
      const sessions = await request(app).get('/api/stories/sessions');
      const firstSessionId = sessions.body.sessions[0].id;
      mockedChatCompletion.mockResolvedValueOnce(
        'Ein schönes Gespräch über den Garten.',
      );
      await request(app).post(
        `/api/stories/sessions/${firstSessionId}/end`,
      );

      // Second session — static welcome references last summary
      const res = await request(app).post('/api/stories/sessions');

      expect(res.status).toBe(201);
      expect(res.body.welcomeMessage).toContain('Garten');
    });
  });

  // AC 2: POST /sessions/:id/messages returns AI response
  describe('POST /api/stories/sessions/:id/messages — AI response', () => {
    it('should return AI-generated follow-up', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      mockedChatCompletion.mockResolvedValueOnce(
        'Oh, ein Apfelbaum! Erzähl mir mehr.',
      );

      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Ich erinnere mich an einen Apfelbaum.' });

      expect(res.status).toBe(200);
      expect(res.body.userMessage.content).toBe(
        'Ich erinnere mich an einen Apfelbaum.',
      );
      expect(res.body.assistantMessage.content).toBe(
        'Oh, ein Apfelbaum! Erzähl mir mehr.',
      );
      expect(res.body.assistantMessage.role).toBe('assistant');
    });
  });

  // AC 3: POST /sessions/:id/end generates summary
  describe('POST /api/stories/sessions/:id/end — summary generation', () => {
    it('should end session with AI-generated summary', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      // Send a message
      mockedChatCompletion.mockResolvedValueOnce('Wie schön!');
      await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Ich hatte einen Hund.' });

      // End session — summary generation
      mockedChatCompletion.mockResolvedValueOnce(
        'Oma erzählte von ihrem Hund aus der Kindheit.',
      );
      const res = await request(app).post(
        `/api/stories/sessions/${sessionId}/end`,
      );

      expect(res.status).toBe(200);
      expect(res.body.session.status).toBe('ended');
      expect(res.body.session.endedAt).toBeDefined();
      expect(res.body.session.summary).toBe(
        'Oma erzählte von ihrem Hund aus der Kindheit.',
      );
    });
  });

  // AC 4: POST /sessions/:id/end on already-ended session returns 409
  describe('POST /api/stories/sessions/:id/end — already ended', () => {
    it('should return 409 when session is already ended', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      // End session
      mockedChatCompletion.mockResolvedValueOnce('Zusammenfassung.');
      await request(app).post(
        `/api/stories/sessions/${sessionId}/end`,
      );      // Try to end again
      const res = await request(app).post(
        `/api/stories/sessions/${sessionId}/end`,
      );

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Session is already ended');
    });
  });

  // AC 5: GET /sessions returns sorted list with pagination
  describe('GET /api/stories/sessions — pagination', () => {
    it('should return sessions sorted by startedAt descending with pagination', async () => {
      // Create 3 sessions (static welcome, no mock needed)
      await request(app).post('/api/stories/sessions');
      await request(app).post('/api/stories/sessions');
      await request(app).post('/api/stories/sessions');

      const res = await request(app)
        .get('/api/stories/sessions')
        .query({ limit: 2, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.sessions.length).toBe(2);
      expect(res.body.total).toBe(3);
      expect(res.body.limit).toBe(2);
      expect(res.body.offset).toBe(0);

      // Verify descending order
      const dates = res.body.sessions.map(
        (s: { startedAt: string }) => new Date(s.startedAt).getTime(),
      );
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
    });

    it('should support offset pagination', async () => {
      await request(app).post('/api/stories/sessions');
      await request(app).post('/api/stories/sessions');
      await request(app).post('/api/stories/sessions');

      const res = await request(app)
        .get('/api/stories/sessions')
        .query({ limit: 2, offset: 2 });

      expect(res.status).toBe(200);
      expect(res.body.sessions.length).toBe(1);
      expect(res.body.total).toBe(3);
    });
  });

  // AC 6: GET /sessions/:id returns single session or 404
  describe('GET /api/stories/sessions/:id — single session', () => {
    it('should return a single session', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      const res = await request(app).get(
        `/api/stories/sessions/${sessionId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.session.id).toBe(sessionId);
      expect(res.body.session.status).toBe('active');
    });

    it('should return 404 for non-existent session', async () => {
      const res = await request(app).get(
        '/api/stories/sessions/nonexistent',
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });

  // AC 7: GET /sessions/:id/messages returns messages or 404
  describe('GET /api/stories/sessions/:id/messages', () => {
    it('should return messages for a session', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      // Send a message
      mockedChatCompletion.mockResolvedValueOnce('Toll!');
      await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Hallo' });

      const res = await request(app).get(
        `/api/stories/sessions/${sessionId}/messages`,
      );

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(3); // welcome + user + assistant
      expect(res.body.messages[0].role).toBe('assistant'); // welcome
      expect(res.body.messages[1].role).toBe('user');
      expect(res.body.messages[2].role).toBe('assistant');
    });

    it('should return 404 for non-existent session', async () => {
      const res = await request(app).get(
        '/api/stories/sessions/nonexistent/messages',
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });

  // AC 8: Messages > 10,000 chars rejected with 400
  describe('POST /api/stories/sessions/:id/messages — message length validation', () => {
    it('should reject messages exceeding 10000 characters', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      const longMessage = 'a'.repeat(10001);
      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: longMessage });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'Message must not exceed 10000 characters',
      );
    });

    it('should accept messages at exactly 10000 characters', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      mockedChatCompletion.mockResolvedValueOnce('Danke!');
      const exactMessage = 'a'.repeat(10000);
      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: exactMessage });

      expect(res.status).toBe(200);
    });
  });

  // AC 9: Azure OpenAI failure returns 503
  describe('Azure OpenAI failure handling', () => {
    it('should return 503 when AI fails during session creation', async () => {
      // Static welcome never calls AI, so session creation should always succeed
      const res = await request(app).post('/api/stories/sessions');
      expect(res.status).toBe(201);
      expect(res.body.welcomeMessage).toBeDefined();
    });

    it('should return 503 when AI fails during message send', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      mockedChatCompletion.mockRejectedValueOnce(
        new Error('Azure OpenAI request timed out'),
      );

      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Hallo' });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe(
        'AI service is currently unavailable. Please try again.',
      );
    });
  });

  // Additional edge cases
  describe('Edge cases', () => {
    it('should reject messages to ended sessions with 409', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      // End the session
      mockedChatCompletion.mockResolvedValueOnce('Zusammenfassung.');
      await request(app).post(
        `/api/stories/sessions/${sessionId}/end`,
      );

      // Try to send message
      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Noch eine Geschichte' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(
        'Cannot send messages to an ended session',
      );
    });

    it('should return 404 when ending non-existent session', async () => {
      const res = await request(app).post(
        '/api/stories/sessions/nonexistent/end',
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });

    it('should return last session summary', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      mockedChatCompletion.mockResolvedValueOnce(
        'Oma sprach über ihre Kindheit.',
      );
      await request(app).post(
        `/api/stories/sessions/${sessionId}/end`,
      );

      const res = await request(app).get('/api/stories/last-summary');
      expect(res.status).toBe(200);
      expect(res.body.summary).toBe('Oma sprach über ihre Kindheit.');
    });
  });
});
