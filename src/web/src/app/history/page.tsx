'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  status: 'active' | 'ended';
  messageCount: number;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (offset: number) => {
    try {
      const res = await fetch(`/api/stories/sessions?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      if (offset === 0) {
        setSessions(data.sessions);
      } else {
        setSessions((prev) => [...prev, ...data.sessions]);
      }
      setTotal(data.total);
    } catch {
      setError('Gespräche konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(0);
  }, [fetchSessions]);

  const handleLoadMore = () => {
    fetchSessions(sessions.length);
  };

  if (loading) {
    return (
      <main
        className="flex flex-col items-center justify-center"
        style={{ backgroundColor: '#FFFBEB', minHeight: 'calc(100vh - 64px)' }}
      >
        <p style={{ fontSize: '20px', color: '#92400E' }}>⏳ Lade Gespräche...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main
        className="flex flex-col items-center justify-center"
        style={{ backgroundColor: '#FFFBEB', minHeight: 'calc(100vh - 64px)' }}
      >
        <p role="alert" style={{ fontSize: '20px', color: '#991B1B' }}>{error}</p>
      </main>
    );
  }

  return (
    <main
      className="flex flex-col items-center px-6"
      style={{
        backgroundColor: '#FFFBEB',
        minHeight: 'calc(100vh - 64px)',
        paddingTop: '32px',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', Palatino, serif",
          fontSize: '30px',
          fontWeight: 700,
          color: '#451A03',
          marginBottom: '24px',
        }}
      >
        📖 Gespräche
      </h1>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: '20px', color: '#78350F', marginBottom: '16px' }}>
            Noch keine Gespräche — starten Sie das erste!
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: 600,
              padding: '16px 32px',
              borderRadius: '12px',
              textDecoration: 'none',
              minWidth: '48px',
              minHeight: '48px',
            }}
          >
            Gespräch starten
          </Link>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/history/${session.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(180, 83, 9, 0.08)',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <div className="flex justify-between items-start" style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#451A03' }}>
                      {formatDate(session.startedAt)}
                    </span>
                    <span style={{ fontSize: '16px', color: '#92400E' }}>
                      {session.messageCount} Nachrichten
                    </span>
                  </div>
                  {session.summary && (
                    <p style={{ fontSize: '18px', color: '#78350F', lineHeight: 1.5, marginBottom: '8px' }}>
                      {session.summary.length > 100
                        ? session.summary.slice(0, 100) + '…'
                        : session.summary}
                    </p>
                  )}
                  <span style={{ fontSize: '16px', color: '#B45309' }}>
                    {formatDuration(session.startedAt, session.endedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {sessions.length < total && (
            <button
              onClick={handleLoadMore}
              style={{
                marginTop: '24px',
                marginBottom: '32px',
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                fontSize: '18px',
                fontWeight: 600,
                padding: '16px 32px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                minWidth: '48px',
                minHeight: '48px',
              }}
            >
              Mehr laden
            </button>
          )}
        </>
      )}
    </main>
  );
}
