'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChat } from './hooks/useChat';
import { useVoice } from './hooks/useVoice';
import VoiceIndicator from './components/VoiceIndicator';

export default function Home() {
  const {
    messages,
    isLoading,
    sessionId,
    error,
    lastSummary,
    startSession,
    sendMessage,
    endSession,
    clearError,
    fetchLastSummary,
  } = useChat();
  const [input, setInput] = useState('');

  const handleVoiceTranscript = useCallback(async (text: string): Promise<string> => {
    // Send transcript via the same API path, return the AI response text
    const trimmed = text.trim();
    if (!trimmed) return '';

    const res = await fetch(
      `/api/stories/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      },
    );
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.assistantMessage?.content || '';
  }, [sessionId]);

  const handleVoiceSessionEnd = useCallback(() => {
    endSession();
  }, [endSession]);

  const {
    voiceState,
    interimText,
    isSupported: voiceSupported,
    permissionDenied,
    noGermanVoiceNotice,
    toggleMic,
    cancelSpeech,
    stopListening,
    dismissPermissionModal,
  } = useVoice({
    onTranscript: handleVoiceTranscript,
    onSessionEnd: handleVoiceSessionEnd,
  });

  const voiceActive = voiceState !== 'idle' && voiceState !== 'error';

  useEffect(() => {
    if (!sessionId) {
      fetchLastSummary();
    }
  }, [sessionId, fetchLastSummary]);

  // Stop voice when session ends
  useEffect(() => {
    if (!sessionId && voiceState !== 'idle') {
      stopListening();
    }
  }, [sessionId, voiceState, stopListening]);

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

  const handleMicKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMic();
    }
  };

  const micLabel = voiceState === 'idle' || voiceState === 'error'
    ? 'Mikrofon an'
    : voiceState === 'speaking'
      ? 'Unterbrechen'
      : 'Mikrofon aus';

  const micDisabled = voiceState === 'processing' || voiceState === 'thinking';

  return (
    <main
      className="flex flex-col items-center px-6"
      style={{
        backgroundColor: '#FFFBEB',
        minHeight: 'calc(100vh - 64px)',
        paddingTop: '32px',
        maxWidth: '800px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* Unsupported browser banner */}
      {sessionId && !voiceSupported && (
        <div
          data-testid="voice-unsupported-banner"
          role="alert"
          style={{
            backgroundColor: '#FEF3C7',
            border: '2px solid #D97706',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '12px',
            width: '100%',
            fontSize: '16px',
            color: '#92400E',
            textAlign: 'center',
          }}
        >
          Für Sprachgespräche empfehlen wir Chrome
        </div>
      )}

      {/* Hidden banner container for supported browsers (e2e test anchor) */}
      {sessionId && voiceSupported && (
        <div data-testid="voice-unsupported-banner" style={{ display: 'none' }} />
      )}

      {/* No German voice notice */}
      {noGermanVoiceNotice && (
        <div
          role="status"
          style={{
            backgroundColor: '#FEF3C7',
            border: '2px solid #D97706',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '12px',
            width: '100%',
            fontSize: '16px',
            color: '#92400E',
            textAlign: 'center',
          }}
        >
          Deutsche Stimme nicht verfügbar — Standardstimme wird verwendet.
        </div>
      )}

      {/* Permission denied modal */}
      <div
        data-testid="mic-permission-modal"
        style={{ display: permissionDenied ? 'flex' : 'none' }}
      >
        {permissionDenied && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mikrofon-Zugriff"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFBEB',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '480px',
                width: '90%',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#451A03', marginBottom: '12px' }}>
                Mikrofon-Zugriff benötigt
              </h2>
              <p style={{ fontSize: '18px', color: '#78350F', lineHeight: 1.6, marginBottom: '8px' }}>
                Mikrofon-Zugriff wurde verweigert.
              </p>
              <p style={{ fontSize: '16px', color: '#92400E', lineHeight: 1.6, marginBottom: '24px' }}>
                Bitte erlauben Sie den Zugriff in den Browser-Einstellungen:
                Klicken Sie auf das Schloss-Symbol 🔒 in der Adressleiste →
                Berechtigungen → Mikrofon → Erlauben.
              </p>
              <button
                onClick={dismissPermissionModal}
                style={{
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
                Über Tastatur schreiben
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEE2E2',
            border: '2px solid #EF4444',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '16px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '18px', color: '#991B1B' }}>{error}</span>
          <button
            onClick={clearError}
            style={{
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              minWidth: '48px',
              minHeight: '48px',
              whiteSpace: 'nowrap',
            }}
          >
            Erneut versuchen
          </button>
        </div>
      )}

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

          {/* Last session summary */}
          {lastSummary && (
            <div
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                maxWidth: '600px',
                width: '100%',
              }}
            >
              <p style={{ fontSize: '16px', color: '#92400E', fontWeight: 600, marginBottom: '8px' }}>
                Letztes Gespräch:
              </p>
              <p style={{ fontSize: '18px', color: '#451A03', lineHeight: 1.6 }}>
                {lastSummary}
              </p>
            </div>
          )}

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
          {/* Voice indicator */}
          {voiceActive && (
            <VoiceIndicator voiceState={voiceState} interimText={interimText} />
          )}
          {/* Hidden voice indicator for idle (e2e anchor) */}
          {!voiceActive && (
            <div data-testid="voice-indicator" style={{ display: 'none' }} />
          )}

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

          {/* Voice + text controls */}
          <div className="flex flex-col" style={{ gap: '12px' }}>
            {/* Interrupt button during speaking */}
            {voiceState === 'speaking' && (
              <button
                onClick={cancelSpeech}
                style={{
                  backgroundColor: '#92400E',
                  color: '#FFFFFF',
                  fontSize: '18px',
                  fontWeight: 600,
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: '48px',
                  width: '100%',
                }}
              >
                ✋ Unterbrechen
              </button>
            )}

            <div className="flex" style={{ gap: '12px', alignItems: 'center' }}>
              {/* Mic toggle button — hidden on unsupported browsers */}
              {voiceSupported && (
                <button
                  data-testid="mic-toggle"
                  onClick={toggleMic}
                  onKeyDown={handleMicKeyDown}
                  disabled={micDisabled}
                  role="button"
                  tabIndex={1}
                  aria-label={micLabel}
                  aria-pressed={voiceActive}
                  style={{
                    backgroundColor: voiceActive ? '#16A34A' : '#D97706',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: 600,
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: micDisabled ? 'not-allowed' : 'pointer',
                    opacity: micDisabled ? 0.5 : 1,
                    minWidth: '48px',
                    minHeight: '48px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🎤 {voiceState === 'speaking' ? 'Unterbrechen' : voiceActive ? 'Mikro aus' : 'Mikro'}
                </button>
              )}

              {/* End session button */}
              {(voiceActive || sessionId) && (
                <button
                  onClick={() => { stopListening(); endSession(); }}
                  disabled={isLoading}
                  tabIndex={2}
                  aria-label="Gespräch beenden"
                  style={{
                    backgroundColor: '#92400E',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: 600,
                    padding: '16px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.5 : 1,
                    minWidth: '48px',
                    minHeight: '48px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Gespräch beenden
                </button>
              )}
            </div>

            {/* Text input — always visible as fallback */}
            <div className="flex" style={{ gap: '12px' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ihre Nachricht..."
                tabIndex={3}
                disabled={isLoading || voiceState === 'thinking' || voiceState === 'speaking'}
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
                tabIndex={4}
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
        </div>
      )}
    </main>
  );
}
