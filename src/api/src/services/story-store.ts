import type { StorySession, StoryMessage } from '../models/story.js';

const sessions = new Map<string, StorySession>();
const messages = new Map<string, StoryMessage[]>();

let idCounter = 0;

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
  return session;
}

export function getSession(id: string): StorySession | undefined {
  return sessions.get(id);
}

export function getAllSessions(): StorySession[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
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
  return msg;
}

export function getSessionMessages(sessionId: string): StoryMessage[] {
  return messages.get(sessionId) ?? [];
}

export function clearStoryStore(): void {
  sessions.clear();
  messages.clear();
  idCounter = 0;
}
