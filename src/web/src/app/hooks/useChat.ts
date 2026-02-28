'use client';

import { useState, useCallback, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stories/sessions', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      sessionIdRef.current = data.session.id;
      setSessionId(data.session.id);
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: data.welcomeMessage,
        },
      ]);
    } catch {
      setMessages([
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es erneut.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !sessionIdRef.current) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/stories/sessions/${sessionIdRef.current}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to send message');
      }
      const data = await res.json();
      const assistantMsg: Message = {
        id: data.assistantMessage.id,
        role: 'assistant',
        content: data.assistantMessage.content,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { messages, isLoading, sessionId, startSession, sendMessage };
}
