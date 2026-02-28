import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { clearStoryStore, addEntities } from '../../src/services/story-store.js';
import type { Entity } from '../../src/models/story.js';

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

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  const now = new Date().toISOString();
  return {
    id: `ent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: 'Onkel Hans',
    type: 'person',
    context: 'Omas Bruder',
    relationship: 'Bruder',
    decade: '1960s',
    sourceMessageIds: ['msg_1'],
    sourceSessionIds: ['sess_1'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Knowledge System — Increment 3', () => {
  const app = createApp();

  beforeEach(() => {
    clearStoryStore();
    vi.clearAllMocks();
    mockedIsConfigured.mockReturnValue(true);
  });

  // Helper: create a session
  async function createTestSession() {
    mockedChatCompletion.mockResolvedValueOnce('Hallo! Erzählen Sie mir eine Geschichte.');
    const res = await request(app).post('/api/stories/sessions');
    return res;
  }

  // --- Entity Extraction Tests ---
  describe('Entity extraction after message', () => {
    it('should extract entities asynchronously after a message', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      // Mock conversation response
      mockedChatCompletion.mockResolvedValueOnce('Oh, Onkel Hans! Erzählen Sie mehr.');
      // Mock extraction response
      mockedChatCompletion.mockResolvedValueOnce(JSON.stringify([
        { name: 'Onkel Hans', type: 'person', context: 'Omas Bruder in München', relationship: 'Bruder', decade: '1960s' },
        { name: 'München', type: 'place', context: 'Stadt wo Hans lebte', relationship: null, decade: '1960s' },
      ]));

      await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Mein Bruder Hans ist in den Sechzigern nach München gezogen.' });

      // Wait for async extraction
      await new Promise((r) => setTimeout(r, 100));

      const entRes = await request(app).get('/api/stories/entities');
      expect(entRes.status).toBe(200);
      expect(entRes.body.entities.length).toBe(2);
      expect(entRes.body.entities.some((e: Entity) => e.name === 'Onkel Hans')).toBe(true);
      expect(entRes.body.entities.some((e: Entity) => e.name === 'München')).toBe(true);
    });

    it('should not break conversation when extraction fails', async () => {
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      // Mock conversation response
      mockedChatCompletion.mockResolvedValueOnce('Wie schön!');
      // Mock extraction failure
      mockedChatCompletion.mockRejectedValueOnce(new Error('Azure timeout'));

      const res = await request(app)
        .post(`/api/stories/sessions/${sessionId}/messages`)
        .send({ message: 'Mein Bruder Hans ist nach München.' });

      expect(res.status).toBe(200);
      expect(res.body.assistantMessage.content).toBe('Wie schön!');

      // Wait for async extraction to settle
      await new Promise((r) => setTimeout(r, 100));

      // No entities were added
      const entRes = await request(app).get('/api/stories/entities');
      expect(entRes.body.entities.length).toBe(0);
    });
  });

  // --- Entity Deduplication ---
  describe('Entity deduplication', () => {
    it('should merge entities with same name and type (case-insensitive)', () => {
      const ent1 = makeEntity({ name: 'Onkel Hans', sourceMessageIds: ['msg_1'], sourceSessionIds: ['sess_1'], context: 'Bruder' });
      const ent2 = makeEntity({ name: 'onkel hans', sourceMessageIds: ['msg_2'], sourceSessionIds: ['sess_2'], context: 'Omas Bruder, der nach München zog' });

      addEntities([ent1]);
      addEntities([ent2]);

      // Should have merged into one
      const res = request(app).get('/api/stories/entities');
      return res.then((r) => {
        expect(r.body.entities.length).toBe(1);
        expect(r.body.entities[0].sourceMessageIds).toContain('msg_1');
        expect(r.body.entities[0].sourceMessageIds).toContain('msg_2');
        // Longer context wins
        expect(r.body.entities[0].context).toBe('Omas Bruder, der nach München zog');
      });
    });
  });

  // --- GET /entities with filters ---
  describe('GET /api/stories/entities', () => {
    it('should return all entities with type filter', async () => {
      addEntities([
        makeEntity({ name: 'Hans', type: 'person' }),
        makeEntity({ name: 'München', type: 'place', context: 'Stadt' }),
      ]);

      const res = await request(app).get('/api/stories/entities').query({ type: 'person' });
      expect(res.status).toBe(200);
      expect(res.body.entities.length).toBe(1);
      expect(res.body.entities[0].name).toBe('Hans');
    });

    it('should return entities with decade filter', async () => {
      addEntities([
        makeEntity({ name: 'Hans', decade: '1960s' }),
        makeEntity({ name: 'München', type: 'place', decade: '1970s', context: 'Stadt' }),
      ]);

      const res = await request(app).get('/api/stories/entities').query({ decade: '1960s' });
      expect(res.status).toBe(200);
      expect(res.body.entities.length).toBe(1);
      expect(res.body.entities[0].name).toBe('Hans');
    });

    it('should support pagination', async () => {
      const ents = Array.from({ length: 5 }, (_, i) =>
        makeEntity({ name: `Person ${i}`, sourceMessageIds: [`msg_${i}`], sourceSessionIds: [`sess_${i}`] }),
      );
      addEntities(ents);

      const res = await request(app).get('/api/stories/entities').query({ limit: 2, offset: 0 });
      expect(res.status).toBe(200);
      expect(res.body.entities.length).toBe(2);
      expect(res.body.total).toBe(5);
    });
  });

  // --- GET /entities/search ---
  describe('GET /api/stories/entities/search', () => {
    it('should search entities by name and context', async () => {
      addEntities([
        makeEntity({ name: 'Onkel Hans', context: 'Bruder in München' }),
        makeEntity({ name: 'Tante Maria', type: 'person', context: 'Schwester', sourceMessageIds: ['msg_2'], sourceSessionIds: ['sess_2'] }),
      ]);

      const res = await request(app).get('/api/stories/entities/search').query({ q: 'Hans' });
      expect(res.status).toBe(200);
      expect(res.body.entities.length).toBe(1);
      expect(res.body.entities[0].name).toBe('Onkel Hans');
    });

    it('should return 400 when q param is missing', async () => {
      const res = await request(app).get('/api/stories/entities/search');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Search query is required');
    });

    it('should return empty array when nothing matches', async () => {
      addEntities([makeEntity({ name: 'Hans' })]);

      const res = await request(app).get('/api/stories/entities/search').query({ q: 'nobody' });
      expect(res.status).toBe(200);
      expect(res.body.entities.length).toBe(0);
      expect(res.body.total).toBe(0);
    });
  });

  // --- GET /coverage ---
  describe('GET /api/stories/coverage', () => {
    it('should return decade coverage with status', async () => {
      addEntities([
        makeEntity({ name: 'Hans', decade: '1960s' }),
        makeEntity({ name: 'Maria', decade: '1960s', type: 'person', sourceMessageIds: ['msg_2'], sourceSessionIds: ['sess_2'] }),
        makeEntity({ name: 'Fritz', decade: '1960s', type: 'person', sourceMessageIds: ['msg_3'], sourceSessionIds: ['sess_3'] }),
        makeEntity({ name: 'Berlin', decade: '1950s', type: 'place', context: 'Geburtsstadt', sourceMessageIds: ['msg_4'], sourceSessionIds: ['sess_4'] }),
      ]);

      const res = await request(app).get('/api/stories/coverage');
      expect(res.status).toBe(200);
      expect(res.body.decades).toHaveLength(10);

      const d1960 = res.body.decades.find((d: { decade: string }) => d.decade === '1960s');
      expect(d1960.entityCount).toBe(3);
      expect(d1960.status).toBe('covered');

      const d1950 = res.body.decades.find((d: { decade: string }) => d.decade === '1950s');
      expect(d1950.entityCount).toBe(1);
      expect(d1950.status).toBe('thin');

      const d1930 = res.body.decades.find((d: { decade: string }) => d.decade === '1930s');
      expect(d1930.entityCount).toBe(0);
      expect(d1930.status).toBe('empty');

      expect(res.body.gaps).toContain('1930s');
      expect(res.body.gaps).toContain('1950s');
      expect(res.body.gaps).not.toContain('1960s');
    });

    it('should return all empty when no entities exist', async () => {
      const res = await request(app).get('/api/stories/coverage');
      expect(res.status).toBe(200);
      expect(res.body.decades.every((d: { status: string }) => d.status === 'empty')).toBe(true);
      expect(res.body.gaps).toHaveLength(10);
    });
  });

  // --- POST /ask ---
  describe('POST /api/stories/ask', () => {
    it('should return narrative answer with sources', async () => {
      // Create a session with a message so we have source data
      const sessionRes = await createTestSession();
      const sessionId = sessionRes.body.session.id;

      addEntities([
        makeEntity({
          name: 'Onkel Hans',
          context: 'Omas Bruder, der nach München zog',
          sourceSessionIds: [sessionId],
          sourceMessageIds: ['msg_1'],
        }),
      ]);

      // Mock the knowledge query AI response
      mockedChatCompletion.mockResolvedValueOnce(
        'Onkel Hans war Omas Bruder. Er ist in den 1960er Jahren nach München gezogen.',
      );

      const res = await request(app)
        .post('/api/stories/ask')
        .send({ question: 'Was weißt du über Onkel Hans?' });

      expect(res.status).toBe(200);
      expect(res.body.answer).toContain('Onkel Hans');
      expect(Array.isArray(res.body.sources)).toBe(true);
    });

    it('should return 400 when question is empty', async () => {
      const res = await request(app)
        .post('/api/stories/ask')
        .send({ question: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Question is required');
    });

    it('should return 400 when question is missing', async () => {
      const res = await request(app)
        .post('/api/stories/ask')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Question is required');
    });

    it('should handle no matching entities gracefully', async () => {
      mockedChatCompletion.mockResolvedValueOnce(
        'Dazu hat Oma leider noch nichts erzählt. Vielleicht können Sie sie beim nächsten Gespräch danach fragen!',
      );

      const res = await request(app)
        .post('/api/stories/ask')
        .send({ question: 'Was weißt du über Tante Frieda?' });

      expect(res.status).toBe(200);
      expect(res.body.answer).toContain('Oma');
      expect(res.body.sources).toEqual([]);
    });
  });
});
