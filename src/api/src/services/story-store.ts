import type { StorySession, StoryMessage, Entity } from '../models/story.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');
const ENTITIES_FILE = path.join(DATA_DIR, 'entities.json');

// In-memory cache backed by JSON files
let sessions = new Map<string, StorySession>();
let messages = new Map<string, StoryMessage[]>();
let entities: Entity[] = [];
let idCounter = 0;
let useFileStorage = false;

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MESSAGES_DIR)) {
    fs.mkdirSync(MESSAGES_DIR, { recursive: true });
  }
}

function atomicWrite(filePath: string, data: string): void {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, data, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function persistSessions(): void {
  if (!useFileStorage) return;
  ensureDirs();
  const arr = Array.from(sessions.values());
  atomicWrite(SESSIONS_FILE, JSON.stringify(arr, null, 2));
}

function persistMessages(sessionId: string): void {
  if (!useFileStorage) return;
  ensureDirs();
  const msgs = messages.get(sessionId) ?? [];
  const filePath = path.join(MESSAGES_DIR, `${sessionId}.json`);
  atomicWrite(filePath, JSON.stringify(msgs, null, 2));
}

function persistEntities(): void {
  if (!useFileStorage) return;
  ensureDirs();
  atomicWrite(ENTITIES_FILE, JSON.stringify(entities, null, 2));
}

function loadFromDisk(): void {
  if (!useFileStorage) return;
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as StorySession[];
      sessions = new Map(data.map((s) => [s.id, s]));
      // Restore idCounter from existing IDs
      for (const s of data) {
        const parts = s.id.split('_');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > idCounter) idCounter = num;
      }
    }
  } catch {
    // Start fresh if file is corrupted
  }

  try {
    if (fs.existsSync(MESSAGES_DIR)) {
      const files = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const sessionId = file.replace('.json', '');
        const data = JSON.parse(
          fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf-8'),
        ) as StoryMessage[];
        messages.set(sessionId, data);
        // Restore idCounter from message IDs
        for (const m of data) {
          const parts = m.id.split('_');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > idCounter) idCounter = num;
        }
      }
    }
  } catch {
    // Start fresh if corrupted
  }

  try {
    if (fs.existsSync(ENTITIES_FILE)) {
      entities = JSON.parse(fs.readFileSync(ENTITIES_FILE, 'utf-8')) as Entity[];
    }
  } catch {
    entities = [];
  }
}

export function initFileStorage(): void {
  useFileStorage = true;
  ensureDirs();
  loadFromDisk();
}

function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

export function createSession(): StorySession {
  const id = generateId('sess');
  const session: StorySession = {
    id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    summary: null,
    status: 'active',
    messageCount: 0,
  };
  sessions.set(id, session);
  messages.set(id, []);
  persistSessions();
  return session;
}

export function getSession(id: string): StorySession | undefined {
  return sessions.get(id);
}

export function getSessionById(id: string): StorySession | undefined {
  return sessions.get(id);
}

export function getAllSessions(): StorySession[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function updateSession(id: string, updates: Partial<StorySession>): StorySession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  Object.assign(session, updates);
  sessions.set(id, session);
  persistSessions();
  return session;
}

export function endSession(id: string, summary: string | null): StorySession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  session.endedAt = new Date().toISOString();
  session.status = 'ended';
  session.summary = summary;
  sessions.set(id, session);
  persistSessions();
  return session;
}

export function addMessage(sessionId: string, role: 'user' | 'assistant', content: string): StoryMessage {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  const msg: StoryMessage = {
    id: generateId('msg'),
    sessionId,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
  const sessionMessages = messages.get(sessionId) ?? [];
  sessionMessages.push(msg);
  messages.set(sessionId, sessionMessages);
  session.messageCount = sessionMessages.length;
  persistSessions();
  persistMessages(sessionId);
  return msg;
}

export function getSessionMessages(sessionId: string): StoryMessage[] {
  return messages.get(sessionId) ?? [];
}

export function clearStoryStore(): void {
  sessions = new Map();
  messages = new Map();
  entities = [];
  idCounter = 0;
  // Don't delete files during clear (used in tests with in-memory mode)
}

// --- Entity storage ---

export function addEntities(newEntities: Entity[]): void {
  for (const newEnt of newEntities) {
    const existing = entities.find(
      (e) => e.name.toLowerCase() === newEnt.name.toLowerCase() && e.type === newEnt.type,
    );

    if (existing) {
      // Merge: accumulate sources, keep longer context
      for (const mid of newEnt.sourceMessageIds) {
        if (!existing.sourceMessageIds.includes(mid)) {
          existing.sourceMessageIds.push(mid);
        }
      }
      for (const sid of newEnt.sourceSessionIds) {
        if (!existing.sourceSessionIds.includes(sid)) {
          existing.sourceSessionIds.push(sid);
        }
      }
      if (newEnt.context.length > existing.context.length) {
        existing.context = newEnt.context;
      }
      existing.updatedAt = new Date().toISOString();
    } else {
      entities.push(newEnt);
    }
  }
  persistEntities();
}

export function getAllEntities(): Entity[] {
  return [...entities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function searchEntities(query: string): Entity[] {
  const q = query.toLowerCase();
  const results = entities.filter(
    (e) => e.name.toLowerCase().includes(q) || e.context.toLowerCase().includes(q),
  );

  // Sort: exact name match first, then name contains, then context contains
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === q ? 0 : 1;
    const bExact = b.name.toLowerCase() === q ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    const aName = a.name.toLowerCase().includes(q) ? 0 : 1;
    const bName = b.name.toLowerCase().includes(q) ? 0 : 1;
    return aName - bName;
  });

  return results.slice(0, 50);
}
