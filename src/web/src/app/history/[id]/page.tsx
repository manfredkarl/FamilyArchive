'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  status: 'active' | 'ended';
  messageCount: number;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Entity {
  id: string;
  name: string;
  type: 'person' | 'year' | 'place' | 'event';
  context: string;
  sourceMessageIds: string[];
  sourceSessionIds: string[];
}

const ENTITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  person: { bg: '#DBEAFE', text: '#1E40AF', label: 'Person' },
  place: { bg: '#D1FAE5', text: '#065F46', label: 'Ort' },
  year: { bg: '#FEF3C7', text: '#92400E', label: 'Jahr' },
  event: { bg: '#EDE9FE', text: '#5B21B6', label: 'Ereignis' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'Laufend';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'Weniger als 1 Minute';
  if (minutes === 1) return '1 Minute';
  return `${minutes} Minuten`;
}

export default function SessionTranscriptPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sessionRes, messagesRes, entitiesRes] = await Promise.all([
        fetch(`/api/stories/sessions/${sessionId}`),
        fetch(`/api/stories/sessions/${sessionId}/messages`),
        fetch('/api/stories/entities'),
      ]);

      if (sessionRes.status === 404) {
        setNotFound(true);
        return;
      }

      if (!sessionRes.ok || !messagesRes.ok) {
        setNotFound(true);
        return;
      }

      const sessionData = await sessionRes.json();
      const messagesData = await messagesRes.json();
      setSession(sessionData.session);
      setMessages(messagesData.messages);

      if (entitiesRes.ok) {
        const entitiesData = await entitiesRes.json();
        // Filter entities that belong to this session
        const sessionEntities = (entitiesData.entities || []).filter(
          (e: Entity) => e.sourceSessionIds.includes(sessionId),
        );
        setEntities(sessionEntities);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get entities for a specific message
  function getEntitiesForMessage(messageId: string): Entity[] {
    return entities.filter((e) => e.sourceMessageIds.includes(messageId));
  }

  if (loading) {
    return (
      <main
        className="flex flex-col items-center justify-center"
        style={{ backgroundColor: '#FFFBEB', minHeight: 'calc(100vh - 64px)' }}
      >
        <p style={{ fontSize: '20px', color: '#92400E' }}>⏳ Lade Gespräch...</p>
      </main>
    );
  }

  if (notFound || !session) {
    return (
      <main
        className="flex flex-col items-center justify-center"
        style={{ backgroundColor: '#FFFBEB', minHeight: 'calc(100vh - 64px)' }}
      >
        <p style={{ fontSize: '24px', color: '#451A03', marginBottom: '16px' }}>
          Gespräch nicht gefunden.
        </p>
        <Link
          href="/history"
          style={{
            fontSize: '18px',
            color: '#D97706',
            textDecoration: 'underline',
            minWidth: '48px',
            minHeight: '48px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          ← Zurück zum Verlauf
        </Link>
      </main>
    );
  }

  // Check if any entities exist to show legend
  const hasEntities = entities.length > 0;
  const entityTypesPresent = [...new Set(entities.map((e) => e.type))];

  return (
    <main
      className="flex flex-col px-6"
      style={{
        backgroundColor: '#FFFBEB',
        minHeight: 'calc(100vh - 64px)',
        paddingTop: '24px',
        paddingBottom: '48px',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      {/* Back link */}
      <Link
        href="/history"
        style={{
          fontSize: '18px',
          color: '#D97706',
          textDecoration: 'none',
          marginBottom: '24px',
          minWidth: '48px',
          minHeight: '48px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        ← Zurück zum Verlauf
      </Link>

      {/* Session header */}
      <div
        style={{
          backgroundColor: '#FEF3C7',
          border: '1px solid #FDE68A',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(180, 83, 9, 0.08)',
        }}
      >
        <h1
          style={{
            fontFamily: "Georgia, 'Times New Roman', Palatino, serif",
            fontSize: '26px',
            fontWeight: 700,
            color: '#451A03',
            marginBottom: '8px',
          }}
        >
          📖 {formatDate(session.startedAt)}
        </h1>
        <div className="flex flex-wrap" style={{ gap: '16px', color: '#78350F', fontSize: '18px' }}>
          <span>⏱ {formatDuration(session.startedAt, session.endedAt)}</span>
          <span>💬 {session.messageCount} Nachrichten</span>
        </div>
        {session.summary && (
          <p style={{ fontSize: '18px', color: '#451A03', marginTop: '12px', lineHeight: 1.5 }}>
            {session.summary}
          </p>
        )}
      </div>

      {/* Entity color legend */}
      {hasEntities && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #FDE68A',
          }}
        >
          <span style={{ fontSize: '16px', color: '#78350F', fontWeight: 600 }}>Legende:</span>
          {entityTypesPresent.map((type) => {
            const color = ENTITY_COLORS[type];
            return (
              <span
                key={type}
                style={{
                  backgroundColor: color.bg,
                  color: color.text,
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '4px 12px',
                  borderRadius: '16px',
                }}
              >
                {color.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Transcript */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg) => {
          const msgEntities = getEntitiesForMessage(msg.id);
          const isUser = msg.role === 'user';

          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  backgroundColor: isUser ? '#FFFFFF' : '#FEF3C7',
                  border: `1px solid ${isUser ? '#E5E7EB' : '#FDE68A'}`,
                  borderRadius: '16px',
                  padding: '16px 20px',
                }}
              >
                <div
                  className="flex justify-between items-center"
                  style={{ marginBottom: '8px' }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#451A03' }}>
                    {isUser ? '👵 Oma' : '🤖 KI-Begleiterin'}
                  </span>
                  <span style={{ fontSize: '14px', color: '#92400E' }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p style={{ fontSize: '18px', color: '#451A03', lineHeight: 1.6, margin: 0 }}>
                  {msg.content}
                </p>
              </div>

              {/* Entity chips for this message */}
              {msgEntities.length > 0 && (
                <div
                  className="flex flex-wrap"
                  style={{ gap: '6px', marginTop: '8px', paddingLeft: '8px' }}
                >
                  {msgEntities.map((entity) => {
                    const color = ENTITY_COLORS[entity.type];
                    return (
                      <span
                        key={entity.id}
                        title={entity.context}
                        style={{
                          backgroundColor: color.bg,
                          color: color.text,
                          fontSize: '14px',
                          fontWeight: 500,
                          padding: '4px 12px',
                          borderRadius: '16px',
                          cursor: 'default',
                        }}
                      >
                        {entity.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
