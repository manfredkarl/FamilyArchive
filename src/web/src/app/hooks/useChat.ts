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
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const fetchLastSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/stories/last-summary');
      if (res.ok) {
        const data = await res.json();
        setLastSummary(data.summary);
      }
    } catch {
      // Ignore errors fetching summary
    }
  }, []);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stories/sessions', { method: 'POST' });
      if (!res.ok) {
        if (res.status === 503) {
          setError('Der KI-Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.');
          return;
        }
        throw new Error('Failed to create session');
      }
      const data = await res.json();
      sessionIdRef.current = data.session.id;
      setSessionId(data.session.id);
      setLastSummary(null);
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: data.welcomeMessage,
        },
      ]);
    } catch {
      setError('Verbindung zum Server fehlgeschlagen. Bitte versuchen Sie es erneut.');
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
    setError(null);

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
        if (res.status === 503) {
          setError('Der KI-Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.');
          return;
        }
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
      setError('Der KI-Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/stories/sessions/${sessionIdRef.current}/end`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to end session');
      }
      const data = await res.json();
      sessionIdRef.current = null;
      setSessionId(null);
      setMessages([]);
      if (data.session?.summary) {
        setLastSummary(data.session.summary);
      }
    } catch {
      setError('Fehler beim Beenden des Gesprächs. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const retryLastAction = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    sessionId,
    error,
    lastSummary,
    startSession,
    sendMessage,
    endSession,
    clearError,
    retryLastAction,
    fetchLastSummary,
  };
}
