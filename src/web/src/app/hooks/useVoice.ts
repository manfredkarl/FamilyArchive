'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionInstance = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface UseVoiceOptions {
  onTranscript: (text: string) => Promise<string>;
  onSessionEnd?: () => void;
}

interface UseVoiceReturn {
  voiceState: VoiceState;
  interimText: string;
  isSupported: boolean;
  errorMessage: string | null;
  permissionDenied: boolean;
  noGermanVoiceNotice: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleMic: () => void;
  cancelSpeech: () => void;
  dismissError: () => void;
  dismissPermissionModal: () => void;
}

// Check browser support
function checkSupport(): boolean {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  return !!SR && !!window.speechSynthesis;
}

function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function selectGermanVoice(): { voice: SpeechSynthesisVoice | null; isGerman: boolean } {
  const voices = window.speechSynthesis.getVoices();
  const germanVoices = voices.filter((v) => v.lang.startsWith('de'));
  if (germanVoices.length === 0) return { voice: null, isGerman: false };
  // Prefer local voices for less latency
  const localVoice = germanVoices.find((v) => v.localService);
  return { voice: localVoice || germanVoices[0], isGerman: true };
}

function chunkText(text: string): string[] {
  if (text.length <= 500) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > 500 && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function useVoice({ onTranscript, onSessionEnd }: UseVoiceOptions): UseVoiceReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [noGermanVoiceNotice, setNoGermanVoiceNotice] = useState(false);
  const [isSupported] = useState(() => checkSupport());

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldRestartRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStateRef = useRef<VoiceState>('idle');
  const noGermanVoiceShownRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  const clearSilenceTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (longSilenceTimerRef.current) {
      clearTimeout(longSilenceTimerRef.current);
      longSilenceTimerRef.current = null;
    }
  }, []);

  const speakText = useCallback((text: string, onComplete?: () => void) => {
    if (!window.speechSynthesis) {
      onComplete?.();
      return;
    }

    window.speechSynthesis.cancel();
    const chunks = chunkText(text);
    let chunkIndex = 0;

    const speakNext = () => {
      if (chunkIndex >= chunks.length) {
        onComplete?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      utterance.lang = 'de-DE';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      const { voice, isGerman } = selectGermanVoice();
      if (voice) {
        utterance.voice = voice;
      }
      if (!isGerman && !noGermanVoiceShownRef.current) {
        noGermanVoiceShownRef.current = true;
        setNoGermanVoiceNotice(true);
      }

      utterance.onend = () => {
        chunkIndex++;
        speakNext();
      };

      utterance.onerror = () => {
        // On TTS error, just move on
        chunkIndex++;
        speakNext();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }, []);

  const startSilenceTimers = useCallback(() => {
    clearSilenceTimers();

    // 30s silence → gentle prompt
    silenceTimerRef.current = setTimeout(() => {
      if (voiceStateRef.current === 'listening') {
        setVoiceState('speaking');
        speakText('Ich bin noch da — möchtest du weitererzählen?', () => {
          if (voiceStateRef.current === 'speaking') {
            setVoiceState('listening');
            startSilenceTimers();
          }
        });
      }
    }, 30000);

    // 5min silence → auto-end
    longSilenceTimerRef.current = setTimeout(() => {
      if (voiceStateRef.current === 'listening' || voiceStateRef.current === 'speaking') {
        setVoiceState('speaking');
        speakText('Es war schön, mit dir zu sprechen. Bis zum nächsten Mal!', () => {
          setVoiceState('idle');
          shouldRestartRef.current = false;
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
          }
          onSessionEnd?.();
        });
      }
    }, 300000);
  }, [clearSilenceTimers, speakText, onSessionEnd]);

  const stopRecognition = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    clearSilenceTimers();
  }, [clearSilenceTimers]);

  const startRecognition = useCallback(() => {
    const SRClass = getSpeechRecognitionClass();
    if (!SRClass) return;

    // Stop any existing recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    const recognition = new SRClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'de-DE';
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      clearSilenceTimers();
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterimText(interim);
      }

      if (finalTranscript.trim()) {
        setInterimText('');
        setVoiceState('processing');

        // Send to API
        setVoiceState('thinking');
        onTranscript(finalTranscript.trim()).then((response) => {
          if (voiceStateRef.current === 'thinking' || voiceStateRef.current === 'processing') {
            setVoiceState('speaking');
            speakText(response, () => {
              if (voiceStateRef.current === 'speaking') {
                setVoiceState('listening');
                startSilenceTimers();
              }
            });
          }
        }).catch(() => {
          setVoiceState('error');
          setErrorMessage('Der KI-Dienst ist gerade nicht erreichbar.');
        });
      }
    };

    recognition.onend = () => {
      // Auto-restart if we should keep listening (handles browser timeout for 60min sessions)
      if (shouldRestartRef.current &&
          (voiceStateRef.current === 'listening')) {
        try {
          setTimeout(() => {
            if (shouldRestartRef.current) {
              recognition.start();
            }
          }, 100);
        } catch { /* ignore */ }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      const errorType = event.error;

      switch (errorType) {
        case 'not-allowed':
          setPermissionDenied(true);
          setVoiceState('error');
          setErrorMessage('Mikrofon-Zugriff wurde verweigert.');
          shouldRestartRef.current = false;
          break;
        case 'no-speech':
          // Silent restart
          if (shouldRestartRef.current) {
            setTimeout(() => {
              if (shouldRestartRef.current) {
                try { recognition.start(); } catch { /* ignore */ }
              }
            }, 1000);
          }
          break;
        case 'audio-capture':
          setVoiceState('error');
          setErrorMessage('Mikrofon nicht gefunden. Bitte schließ ein Mikrofon an.');
          shouldRestartRef.current = false;
          break;
        case 'network':
          setVoiceState('error');
          setErrorMessage('Spracherkennung nicht verfügbar. Bitte prüf deine Internetverbindung.');
          shouldRestartRef.current = false;
          break;
        case 'aborted':
          // Normal during state transitions — no action
          break;
        default:
          // Recoverable errors — auto-retry
          if (shouldRestartRef.current) {
            setTimeout(() => {
              if (shouldRestartRef.current) {
                try { recognition.start(); } catch { /* ignore */ }
              }
            }, 1000);
          }
          break;
      }
    };

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;

    try {
      recognition.start();
      setVoiceState('listening');
      setInterimText('');
      setErrorMessage(null);
      startSilenceTimers();
    } catch {
      setVoiceState('error');
      setErrorMessage('Spracherkennung konnte nicht gestartet werden.');
    }
  }, [onTranscript, speakText, clearSilenceTimers, startSilenceTimers]);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    startRecognition();
  }, [isSupported, startRecognition]);

  const stopListening = useCallback(() => {
    stopRecognition();
    setVoiceState('idle');
    setInterimText('');
    window.speechSynthesis?.cancel();
  }, [stopRecognition]);

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (voiceStateRef.current === 'speaking') {
      setVoiceState('listening');
      shouldRestartRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* ignore */ }
      }
      startSilenceTimers();
    }
  }, [startSilenceTimers]);

  const toggleMic = useCallback(() => {
    if (voiceState === 'idle' || voiceState === 'error') {
      startListening();
    } else if (voiceState === 'speaking') {
      cancelSpeech();
    } else if (voiceState === 'listening') {
      stopListening();
    }
  }, [voiceState, startListening, stopListening, cancelSpeech]);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
    setVoiceState('idle');
  }, []);

  const dismissPermissionModal = useCallback(() => {
    setPermissionDenied(false);
    setVoiceState('idle');
    setErrorMessage(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
      window.speechSynthesis?.cancel();
    };
  }, [stopRecognition]);

  return {
    voiceState,
    interimText,
    isSupported,
    errorMessage,
    permissionDenied,
    noGermanVoiceNotice,
    startListening,
    stopListening,
    toggleMic,
    cancelSpeech,
    dismissError,
    dismissPermissionModal,
  };
}
