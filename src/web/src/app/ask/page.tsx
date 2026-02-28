'use client';

import { useState } from 'react';

interface SourceReference {
  sessionId: string;
  sessionDate: string;
  messageId: string;
  excerpt: string;
}

const EXAMPLE_QUESTIONS = [
  'Was weißt du über die Familie?',
  'Wo ist Oma aufgewachsen?',
  'Welche Berufe gab es in der Familie?',
  'Was passierte in den 1960er Jahren?',
];

export default function AskPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (q?: string) => {
    const text = (q || question).trim();
    if (!text) return;

    setIsLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      const res = await fetch('/api/stories/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Anfrage fehlgeschlagen');
      }

      const data = await res.json();
      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAsk();
    }
  };

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
          marginBottom: '8px',
        }}
      >
        🔍 Fragen
      </h1>
      <p style={{ fontSize: '20px', color: '#78350F', marginBottom: '24px' }}>
        Was möchtest du wissen?
      </p>

      {/* Search input */}
      <div className="flex w-full" style={{ gap: '12px', marginBottom: '16px' }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Stelle eine Frage über Omas Geschichten..."
          disabled={isLoading}
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            border: '2px solid #FDE68A',
            borderRadius: '12px',
            padding: '16px 20px',
            fontSize: '18px',
            color: '#451A03',
            outline: 'none',
          }}
        />
        <button
          onClick={() => handleAsk()}
          disabled={isLoading || !question.trim()}
          style={{
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            fontSize: '18px',
            fontWeight: 600,
            padding: '16px 24px',
            borderRadius: '12px',
            border: 'none',
            cursor: isLoading || !question.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !question.trim() ? 0.5 : 1,
            minWidth: '48px',
            minHeight: '48px',
            whiteSpace: 'nowrap',
          }}
        >
          Fragen
        </button>
      </div>

      {/* Example question chips */}
      <div className="flex flex-wrap" style={{ gap: '8px', marginBottom: '24px', width: '100%' }}>
        {EXAMPLE_QUESTIONS.map((eq) => (
          <button
            key={eq}
            onClick={() => {
              setQuestion(eq);
              handleAsk(eq);
            }}
            disabled={isLoading}
            style={{
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              fontSize: '16px',
              fontWeight: 500,
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid #FDE68A',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              minHeight: '48px',
            }}
          >
            {eq}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ color: '#92400E', fontSize: '18px', padding: '24px' }}>
          ⏳ Suche in Omas Geschichten...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEE2E2',
            border: '2px solid #EF4444',
            borderRadius: '12px',
            padding: '16px 20px',
            width: '100%',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '18px', color: '#991B1B' }}>{error}</span>
        </div>
      )}

      {/* Answer card */}
      {answer && (
        <div
          style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #FDE68A',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            boxShadow: '0 2px 8px rgba(180, 83, 9, 0.08)',
          }}
        >
          <p style={{ fontSize: '20px', color: '#451A03', lineHeight: 1.6 }}>{answer}</p>

          {sources.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #FDE68A', paddingTop: '12px' }}>
              <p style={{ fontSize: '16px', color: '#92400E', fontWeight: 600, marginBottom: '8px' }}>
                Quellen:
              </p>
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={`/history/${src.sessionId}`}
                  style={{
                    display: 'block',
                    fontSize: '16px',
                    color: '#D97706',
                    marginBottom: '4px',
                    textDecoration: 'underline',
                  }}
                >
                  📖 Gespräch vom {new Date(src.sessionDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
