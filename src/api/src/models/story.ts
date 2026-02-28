export interface StorySession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  status: 'active' | 'ended';
  messageCount: number;
}

export interface StoryMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Entity {
  id: string;
  name: string;
  type: 'person' | 'year' | 'place' | 'event';
  context: string;
  relationship: string | null;
  decade: string | null;
  sourceMessageIds: string[];
  sourceSessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DecadeCoverage {
  decade: string;
  entityCount: number;
  status: 'empty' | 'thin' | 'covered';
}
