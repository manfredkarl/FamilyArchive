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
