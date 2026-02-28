'use client';

import React from 'react';
import type { VoiceState } from '../hooks/useVoice';
import type { VoiceLiveState } from '../hooks/useVoiceLive';

type AnyVoiceState = VoiceState | VoiceLiveState;

interface VoiceIndicatorProps {
  voiceState: AnyVoiceState;
  interimText: string;
  /** When true, render the large center-screen variant for VoiceLive mode */
  large?: boolean;
}

const stateConfig: Record<string, { icon: string; label: string; color: string; ringColor: string; animation?: string }> = {
  idle: { icon: '🎤', label: 'Bereit zum Starten', color: '#9CA3AF', ringColor: '#9CA3AF' },
  connecting: { icon: '🔄', label: 'Verbinde…', color: '#D97706', ringColor: '#FDE68A', animation: 'spin' },
  listening: { icon: '👂', label: 'Ich höre zu…', color: '#16A34A', ringColor: '#86EFAC', animation: 'pulse' },
  processing: { icon: '⏳', label: 'Verarbeite Sprache…', color: '#D97706', ringColor: '#FDE68A', animation: 'spin' },
  thinking: { icon: '💭', label: 'Denke nach…', color: '#D97706', ringColor: '#FDE68A', animation: 'pulse' },
  speaking: { icon: '💬', label: 'Spricht…', color: '#16A34A', ringColor: '#86EFAC', animation: 'wave' },
  error: { icon: '⚠️', label: 'Fehler aufgetreten', color: '#EF4444', ringColor: '#FCA5A5' },
};

export default function VoiceIndicator({ voiceState, interimText, large = false }: VoiceIndicatorProps) {
  const config = stateConfig[voiceState] || stateConfig.idle;

  if (voiceState === 'idle') return null;

  // ---------- Large (VoiceLive center-screen) variant ----------
  if (large) {
    return (
      <div
        data-testid="voice-indicator"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '32px 0',
        }}
      >
        {/* Pulsing circle */}
        <div
          style={{
            position: 'relative',
            width: '160px',
            height: '160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Outer ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `4px solid ${config.ringColor}`,
              opacity: 0.4,
              animation:
                config.animation === 'pulse'
                  ? 'vlRingPulse 2s ease-in-out infinite'
                  : config.animation === 'wave'
                    ? 'vlRingWave 1.2s ease-in-out infinite'
                    : config.animation === 'spin'
                      ? 'vlRingSpin 1.2s linear infinite'
                      : undefined,
            }}
          />
          {/* Inner filled circle */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: config.color,
              opacity: 0.15,
              position: 'absolute',
              animation:
                config.animation === 'pulse'
                  ? 'vlCorePulse 2s ease-in-out infinite'
                  : config.animation === 'wave'
                    ? 'vlCoreWave 1.2s ease-in-out infinite'
                    : undefined,
            }}
          />
          {/* Icon */}
          <span style={{ fontSize: '48px', zIndex: 1 }}>{config.icon}</span>
        </div>

        {/* State label */}
        <span
          style={{
            fontSize: '22px',
            fontWeight: 600,
            color: config.color,
          }}
        >
          {config.label}
        </span>

        {/* Interim text */}
        {interimText && (
          <div
            aria-live="off"
            style={{
              fontSize: '20px',
              color: '#78350F',
              fontStyle: 'italic',
              textAlign: 'center',
              maxWidth: '600px',
              lineHeight: 1.6,
            }}
          >
            {interimText}
          </div>
        )}

        {/* ARIA status */}
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

        <style>{`
          @keyframes vlRingPulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.15); opacity: 0.2; }
          }
          @keyframes vlCorePulse {
            0%, 100% { transform: scale(1); opacity: 0.15; }
            50% { transform: scale(1.08); opacity: 0.25; }
          }
          @keyframes vlRingWave {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            25% { transform: scale(1.1); opacity: 0.3; }
            50% { transform: scale(1.05); opacity: 0.5; }
            75% { transform: scale(1.12); opacity: 0.25; }
          }
          @keyframes vlCoreWave {
            0%, 100% { transform: scale(1); opacity: 0.15; }
            25% { transform: scale(1.06); opacity: 0.2; }
            50% { transform: scale(1.03); opacity: 0.25; }
            75% { transform: scale(1.08); opacity: 0.18; }
          }
          @keyframes vlRingSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // ---------- Compact (legacy) variant ----------
  return (
    <div data-testid="voice-indicator" style={{ width: '100%', marginBottom: '16px' }}>
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
