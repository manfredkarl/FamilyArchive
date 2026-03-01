'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChat } from './hooks/useChat';
import { useVoice } from './hooks/useVoice';
import { useVoiceLive } from './hooks/useVoiceLive';
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
  const [textMode, setTextMode] = useState(false);

  // VoiceLive hook (primary voice mode)
  const voiceLive = useVoiceLive();

  // Legacy browser-based voice (fallback for text-chat sessions)
  const handleVoiceTranscript = useCallback(async (text: string): Promise<string> => {
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
    interimText: legacyInterimText,
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

  const legacyVoiceActive = voiceState !== 'idle' && voiceState !== 'error';
  const voiceLiveActive = voiceLive.state !== 'idle' && voiceLive.state !== 'error';

  useEffect(() => {
    if (!sessionId) {
      fetchLastSummary();
    }
  }, [sessionId, fetchLastSummary]);

  // Stop legacy voice when session ends
  useEffect(() => {
    if (!sessionId && voiceState !== 'idle') {
      stopListening();
    }
  }, [sessionId, voiceState, stopListening]);

  // ---------- handlers ----------

  const handleStartVoice = useCallback(() => {
    setTextMode(false);
    voiceLive.startSession();
  }, [voiceLive]);

  const handleEndVoice = useCallback(() => {
    voiceLive.endSession();
  }, [voiceLive]);

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

  // ============================================================
  // RENDER
  // ============================================================

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
      {/* ---- Error banner ---- */}
      {(error || voiceLive.errorMessage) && (
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
          <span style={{ fontSize: '18px', color: '#991B1B' }}>
            {error || voiceLive.errorMessage}
          </span>
          <button
            onClick={() => { clearError(); }}
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

      {/* ================================================================
          SCREEN 1: Before any session — welcome + start voice
         ================================================================ */}
      {!voiceLiveActive && !sessionId && (
        <div className="flex flex-col items-center justify-center" style={{ flex: 1, paddingTop: '60px' }}>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', Palatino, serif",
              fontSize: 'clamp(28px, 5vw, 40px)',
              fontWeight: 700,
              color: '#451A03',
              marginBottom: '12px',
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
          >
            💛 Omas Geschichten
          </h1>
          <p style={{ fontSize: '20px', color: '#78350F', marginBottom: '40px', textAlign: 'center' }}>
            Erzähl mir deine Geschichte.
          </p>

          {/* Last session summary */}
          {lastSummary && (
            <div
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '32px',
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

          {/* Primary: Start voice session */}
          <button
            onClick={handleStartVoice}
            style={{
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              fontSize: '22px',
              fontWeight: 700,
              padding: '20px clamp(32px, 5vw, 48px)',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              minWidth: '48px',
              minHeight: '48px',
              boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)',
            }}
          >
            🎙️ Gespräch starten
          </button>
          <p style={{ fontSize: '16px', color: '#92400E', marginTop: '16px', textAlign: 'center' }}>
            Drück den Knopf und erzähl einfach
          </p>

          {/* Small text-mode fallback */}
          <button
            onClick={() => { setTextMode(true); startSession(); }}
            disabled={isLoading}
            style={{
              marginTop: '32px',
              background: 'none',
              border: 'none',
              color: '#92400E',
              fontSize: '15px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              opacity: isLoading ? 0.5 : 0.7,
            }}
          >
            ⌨️ Lieber über Tastatur schreiben
          </button>
        </div>
      )}

      {/* ================================================================
          SCREEN 2: VoiceLive session active (PRIMARY voice mode)
         ================================================================ */}
      {voiceLiveActive && (
        <div className="flex flex-col items-center w-full" style={{ flex: 1, paddingBottom: '24px' }}>
          {/* Large voice indicator */}
          <VoiceIndicator voiceState={voiceLive.state} interimText={voiceLive.interimText} large />

          {/* Live transcript */}
          <div
            data-testid="voice-transcript-list"
            style={{
              flex: 1,
              width: '100%',
              overflowY: 'auto',
              maxHeight: '45vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '16px',
              marginBottom: '24px',
              paddingRight: '8px',
            }}
          >
            {voiceLive.transcripts.map((t) => (
              <div
                key={t.id}
                style={{
                  alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: t.role === 'user' ? '#D97706' : '#FEF3C7',
                  color: t.role === 'user' ? '#FFFFFF' : '#451A03',
                  padding: '12px 16px',
                  borderRadius:
                    t.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  maxWidth: '85%',
                  fontSize: 'clamp(16px, 2.5vw, 18px)',
                  lineHeight: 1.5,
                  opacity: t.isFinal ? 1 : 0.6,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  {t.role === 'user' ? 'Oma' : 'KI'}
                </span>
                {t.text}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center" style={{ gap: '12px', width: '100%' }}>
            <button
              onClick={handleEndVoice}
              style={{
                backgroundColor: '#92400E',
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
              Gespräch beenden
            </button>

            {/* Toggle to text mode */}
            <button
              onClick={() => {
                handleEndVoice();
                setTextMode(true);
                startSession();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#92400E',
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'underline',
                opacity: 0.7,
              }}
            >
              ⌨️ Über Tastatur
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          SCREEN 3: Text chat session (fallback mode)
         ================================================================ */}
      {sessionId && !voiceLiveActive && (
        <div className="flex flex-col w-full" style={{ flex: 1, paddingBottom: '24px' }}>
          {/* Unsupported browser banner */}
          {!voiceSupported && (
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
          {voiceSupported && (
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
                    Bitte erlaube den Zugriff in den Browser-Einstellungen:
                    Klick auf das Schloss-Symbol 🔒 in der Adressleiste →
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

          {/* Voice indicator (legacy) */}
          {legacyVoiceActive && (
            <VoiceIndicator voiceState={voiceState} interimText={legacyInterimText} />
          )}
          {!legacyVoiceActive && (
            <div data-testid="voice-indicator" style={{ display: 'none' }} />
          )}

          {/* Message list */}
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
                  padding: 'clamp(12px, 2vw, 16px) clamp(16px, 2.5vw, 20px)',
                  borderRadius:
                    msg.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  maxWidth: '85%',
                  fontSize: 'clamp(17px, 2.5vw, 20px)',
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

            <div className="flex" style={{ gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                  aria-pressed={legacyVoiceActive}
                  style={{
                    backgroundColor: legacyVoiceActive ? '#16A34A' : '#D97706',
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
                  🎤 {voiceState === 'speaking' ? 'Unterbrechen' : legacyVoiceActive ? 'Mikro aus' : 'Mikro'}
                </button>
              )}

              {/* End session button */}
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
            </div>

            {/* Text input */}
            <div className="flex" style={{ gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Deine Nachricht..."
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
                  flexShrink: 0,
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
