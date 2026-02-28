'use client';

import React from 'react';
import type { VoiceState } from '../hooks/useVoice';

interface VoiceIndicatorProps {
  voiceState: VoiceState;
  interimText: string;
}

const stateConfig: Record<VoiceState, { icon: string; label: string; color: string; animation?: string }> = {
  idle: { icon: '🎤', label: 'Bereit zum Starten', color: '#9CA3AF' },
  listening: { icon: '👂', label: 'Ich höre zu', color: '#16A34A', animation: 'pulse' },
  processing: { icon: '⏳', label: 'Verarbeite Sprache', color: '#D97706', animation: 'spin' },
  thinking: { icon: '💭', label: 'Denke nach', color: '#D97706', animation: 'pulse' },
  speaking: { icon: '💬', label: 'Spreche Antwort', color: '#16A34A', animation: 'wave' },
  error: { icon: '⚠️', label: 'Fehler aufgetreten', color: '#EF4444' },
};

export default function VoiceIndicator({ voiceState, interimText }: VoiceIndicatorProps) {
  const config = stateConfig[voiceState];

  if (voiceState === 'idle') return null;

  return (
    <div data-testid="voice-indicator" style={{ width: '100%', marginBottom: '16px' }}>
      {/* State indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: voiceState === 'error' ? '#FEE2E2' : '#FEF3C7',
          borderRadius: '12px',
          border: `2px solid ${config.color}`,
        }}
      >
        <span
          style={{
            fontSize: '28px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: voiceState === 'listening' ? 'rgba(22, 163, 74, 0.15)' : 'transparent',
            animation:
              config.animation === 'pulse'
                ? 'voicePulse 1.5s ease-in-out infinite'
                : config.animation === 'spin'
                  ? 'voiceSpin 1s linear infinite'
                  : undefined,
          }}
        >
          {config.icon}
        </span>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: config.color,
          }}
        >
          {config.label}
        </span>
      </div>

      {/* Interim transcript */}
      {voiceState === 'listening' && interimText && (
        <div
          aria-live="off"
          style={{
            marginTop: '8px',
            padding: '8px 16px',
            fontSize: '18px',
            color: '#9CA3AF',
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          {interimText}
        </div>
      )}

      {/* ARIA live region for state announcements */}
      <div
        data-testid="voice-aria-status"
        aria-live="polite"
        role="status"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {config.label}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes voicePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes voiceSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
