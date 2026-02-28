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

export interface CreateSessionResponse {
  session: StorySession;
  welcomeMessage: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface SendMessageResponse {
  userMessage: StoryMessage;
  assistantMessage: StoryMessage;
}

export interface EndSessionResponse {
  session: StorySession;
}

export interface SessionListResponse {
  sessions: StorySession[];
  total: number;
  limit: number;
  offset: number;
}

export interface ErrorResponse {
  error: string;
}

// --- Knowledge System (Increment 3) ---

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

export interface CoverageResponse {
  decades: DecadeCoverage[];
  gaps: string[];
}

export interface KnowledgeQueryRequest {
  question: string;
}

export interface KnowledgeQueryResponse {
  answer: string;
  sources: SourceReference[];
}

export interface SourceReference {
  sessionId: string;
  sessionDate: string;
  messageId: string;
  excerpt: string;
}

export interface EntityListResponse {
  entities: Entity[];
  total: number;
}

export interface EntitySearchResponse {
  entities: Entity[];
  total: number;
}
