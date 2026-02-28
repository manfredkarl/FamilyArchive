export interface StorySession {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  summary?: string | null;
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
