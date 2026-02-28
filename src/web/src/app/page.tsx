'use client';

import { useState } from 'react';
import { useChat } from './hooks/useChat';

export default function Home() {
  const { messages, isLoading, sessionId, startSession, sendMessage } = useChat();
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      {!sessionId ? (
        <div className="flex flex-col items-center justify-center" style={{ flex: 1, paddingTop: '80px' }}>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', Palatino, serif",
              fontSize: '36px',
              fontWeight: 700,
              color: '#451A03',
              marginBottom: '16px',
            }}
          >
            Omas Geschichten 💛
          </h1>
          <p style={{ fontSize: '20px', color: '#78350F', marginBottom: '32px' }}>
            Erzählen Sie mir Ihre Geschichte.
          </p>
          <button
            onClick={startSession}
            disabled={isLoading}
            style={{
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: 600,
              padding: '16px 32px',
              borderRadius: '12px',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              minWidth: '48px',
              minHeight: '48px',
            }}
          >
            {isLoading ? 'Wird gestartet...' : 'Gespräch starten'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full" style={{ flex: 1, paddingBottom: '24px' }}>
          <div
            data-testid="message-list"
            className="flex flex-col"
            style={{ flex: 1, overflowY: 'auto', gap: '16px', marginBottom: '24px' }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                data-testid={`message-${msg.role}`}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#D97706' : '#FEF3C7',
                  color: msg.role === 'user' ? '#FFFFFF' : '#451A03',
                  padding: '16px 20px',
                  borderRadius:
                    msg.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  maxWidth: '80%',
                  fontSize: '20px',
                  lineHeight: 1.6,
                }}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  color: '#92400E',
                  fontSize: '18px',
                  padding: '16px 20px',
                }}
              >
                ⏳ Einen Moment...
              </div>
            )}
          </div>
          <div className="flex" style={{ gap: '12px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ihre Nachricht..."
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
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              aria-label="Senden"
              style={{
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                fontSize: '18px',
                fontWeight: 600,
                padding: '16px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !input.trim() ? 0.5 : 1,
                minWidth: '48px',
                minHeight: '48px',
              }}
            >
              ➤ Senden
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
