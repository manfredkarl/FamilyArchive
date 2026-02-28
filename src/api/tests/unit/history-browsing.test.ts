import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { clearStoryStore } from '../../src/services/story-store.js';

// Mock the openai-client module
vi.mock('../../src/services/openai-client.js', () => ({
  isOpenAIConfigured: vi.fn(() => true),
  chatCompletion: vi.fn(),
  getFallbackWelcome: vi.fn((isFirst: boolean) =>
    isFirst
      ? 'Willkommen zum ersten Gespräch!'
      : 'Schön, dass Sie wieder da sind!',
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

describe('History Browsing — Increment 4', () => {
  const app = createApp();

  beforeEach(() => {
    clearStoryStore();
    vi.clearAllMocks();
    mockedIsConfigured.mockReturnValue(true);
  });

  // Helper: create a session with mocked AI welcome
  async function createTestSession() {
    mockedChatCompletion.mockResolvedValueOnce(
      'Hallo! Erzählen Sie mir eine Geschichte.',
    );
    const res = await request(app).post('/api/stories/sessions');
    return res;
  }

  // Helper: create a session with messages and end it
  async function createEndedSessionWithMessages(summary: string) {
    const sessionRes = await createTestSession();
    const sessionId = sessionRes.body.session.id;

    // Send a message
    mockedChatCompletion.mockResolvedValueOnce('Das ist wunderbar! Erzählen Sie weiter.');
    await request(app)
      .post(`/api/stories/sessions/${sessionId}/messages`)
      .send({ message: 'Ich erinnere mich an den Garten.' });

    // End session with summary
    mockedChatCompletion.mockResolvedValueOnce(summary);
    await request(app).post(`/api/stories/sessions/${sessionId}/end`);

    return sessionId;
  }

  describe('GET /api/stories/sessions — session list', () => {
    it('should return session list sorted by startedAt descending', async () => {
      // Create multiple sessions
      await createEndedSessionWithMessages('Erstes Gespräch über den Garten.');
      await createEndedSessionWithMessages('Zweites Gespräch über die Schule.');
      await createEndedSessionWithMessages('Drittes Gespräch über den Beruf.');

      const res = await request(app).get('/api/stories/sessions');

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(3);
      expect(res.body.total).toBe(3);

      // Verify descending order by startedAt
      const dates = res.body.sessions.map(
        (s: { startedAt: string }) => new Date(s.startedAt).getTime(),
      );
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });

    it('should return empty list when no sessions exist', async () => {
      const res = await request(app).get('/api/stories/sessions');

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it('should include session summary and message count', async () => {
      await createEndedSessionWithMessages('Oma erzählte vom Garten.');

      const res = await request(app).get('/api/stories/sessions');

      expect(res.status).toBe(200);
      const session = res.body.sessions[0];
      expect(session.summary).toBe('Oma erzählte vom Garten.');
      expect(session.messageCount).toBeGreaterThan(0);
      expect(session.startedAt).toBeDefined();
      expect(session.endedAt).toBeDefined();
    });
  });

  describe('GET /api/stories/sessions/:id — single session', () => {
    it('should return session with all fields', async () => {
      const sessionId = await createEndedSessionWithMessages('Eine schöne Erinnerung.');

      const res = await request(app).get(`/api/stories/sessions/${sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.session.id).toBe(sessionId);
      expect(res.body.session.summary).toBe('Eine schöne Erinnerung.');
      expect(res.body.session.status).toBe('ended');
      expect(res.body.session.startedAt).toBeDefined();
      expect(res.body.session.endedAt).toBeDefined();
      expect(res.body.session.messageCount).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent session', async () => {
      const res = await request(app).get('/api/stories/sessions/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });

  describe('GET /api/stories/sessions/:id/messages — session messages', () => {
    it('should return messages for a session sorted by timestamp', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      // Send messages
      mockedChatCompletion.mockResolvedValueOnce('Wie schön! Erzählen Sie mir mehr.');
      await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Es war ein warmer Sommer.' });

      mockedChatCompletion.mockResolvedValueOnce('Das klingt wunderbar.');
      await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Die Kinder spielten im Garten.' });

      const res = await request(app).get(`/api/stories/sessions/${sessionId}/messages`);

      expect(res.status).toBe(200);
      // welcome + user1 + assistant1 + user2 + assistant2 = 5 messages
      expect(res.body.messages.length).toBe(5);

      // Verify timestamps are ascending
      const timestamps = res.body.messages.map(
        (m: { timestamp: string }) => new Date(m.timestamp).getTime(),
      );
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
      }

      // Verify message structure
      expect(res.body.messages[0].role).toBe('assistant'); // welcome
      expect(res.body.messages[1].role).toBe('user');
      expect(res.body.messages[1].content).toBe('Es war ein warmer Sommer.');
      expect(res.body.messages[2].role).toBe('assistant');
    });

    it('should return 404 for non-existent session messages', async () => {
      const res = await request(app).get('/api/stories/sessions/nonexistent-id/messages');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });
});
