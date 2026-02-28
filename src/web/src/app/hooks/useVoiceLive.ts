'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type VoiceLiveState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface UseVoiceLiveReturn {
  state: VoiceLiveState;
  transcripts: TranscriptEntry[];
  interimText: string;
  errorMessage: string | null;
  startSession: () => void;
  endSession: () => void;
}

const VOICE_WS_URL =
  process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws') + '/api/voice'
    : 'ws://localhost:5001/api/voice';

const VL_SAMPLE_RATE = 24000;

const SYSTEM_PROMPT = `Du bist eine warmherzige, geduldige KI-Begleiterin, die Oma dabei hilft, ihre Lebensgeschichten zu bewahren.

Deine Regeln:
- Sprich immer auf Deutsch, in einem warmen, respektvollen Ton.
- Höre aufmerksam zu und zeige echtes Interesse.
- Stelle sanfte Nachfragen (Wer? Wo? Wann? Wie hat sich das angefühlt?).
- Unterbreche niemals.
- Halte deine Antworten kurz und herzlich (2-4 Sätze).
- Frage nach verschiedenen Lebensjahrzehnten.`;

/**
 * PCM16-capture AudioWorklet processor.
 * Resamples from the AudioContext's native rate to 24 kHz and emits PCM16 LE.
 */
const WORKLET_SOURCE = `
class Pcm16CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / 24000;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;
    const float32 = input[0];

    // Resample: pick every _ratio-th sample (simple decimation)
    const outLen = Math.floor(float32.length / this._ratio);
    if (outLen === 0) return true;
    const pcm16 = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIdx = Math.round(i * this._ratio);
      const s = Math.max(-1, Math.min(1, float32[srcIdx] || 0));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}
registerProcessor('pcm16-capture', Pcm16CaptureProcessor);
`;

/** Convert an ArrayBuffer of PCM16 bytes to a base64 string. */
function pcm16ToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode a base64 string to an ArrayBuffer. */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

let _nextId = 0;
function uid(): string {
  return `t-${Date.now()}-${_nextId++}`;
}

export function useVoiceLive(): UseVoiceLiveReturn {
  const [state, setState] = useState<VoiceLiveState>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const stateRef = useRef<VoiceLiveState>('idle');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ---------- audio playback (seamless streaming) ----------

  const scheduleAudioChunk = useCallback((pcm16Bytes: ArrayBuffer) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    // Ensure even byte length for Int16Array
    const byteLen = pcm16Bytes.byteLength - (pcm16Bytes.byteLength % 2);
    if (byteLen === 0) return;

    const int16 = new Int16Array(pcm16Bytes, 0, byteLen / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    // Create buffer at 24kHz — AudioContext auto-resamples to native rate
    const buffer = ctx.createBuffer(1, float32.length, VL_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  const stopPlayback = useCallback(() => {
    nextPlayTimeRef.current = 0;
    // Close and recreate playback context to cancel all scheduled sources
    if (playbackCtxRef.current) {
      try { playbackCtxRef.current.close(); } catch { /* ignore */ }
      playbackCtxRef.current = new AudioContext();
    }
  }, []);

  // ---------- cleanup ----------

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    if (workletNodeRef.current) {
      try { workletNodeRef.current.disconnect(); } catch { /* ignore */ }
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* ignore */ }
      sourceNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (captureCtxRef.current) {
      try { captureCtxRef.current.close(); } catch { /* ignore */ }
      captureCtxRef.current = null;
    }
    if (playbackCtxRef.current) {
      try { playbackCtxRef.current.close(); } catch { /* ignore */ }
      playbackCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  }, []);

  // ---------- endSession ----------

  const endSession = useCallback(() => {
    cleanup();
    setState('idle');
    setInterimText('');
  }, [cleanup]);

  // ---------- startSession ----------

  const startSession = useCallback(async () => {
    cleanup();
    setTranscripts([]);
    setInterimText('');
    setErrorMessage(null);
    setState('connecting');

    try {
      // 1. Get mic access (mono, noise/echo suppressed)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Capture AudioContext (native rate — worklet resamples to 24kHz)
      const captureCtx = new AudioContext();
      captureCtxRef.current = captureCtx;

      // 3. Playback AudioContext (native rate — createBuffer(24kHz) auto-resamples)
      const playbackCtx = new AudioContext();
      playbackCtxRef.current = playbackCtx;

      // 4. Register worklet
      const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await captureCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // 5. Connect mic → worklet
      const micSource = captureCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = micSource;

      const worklet = new AudioWorkletNode(captureCtx, 'pcm16-capture');
      workletNodeRef.current = worklet;
      micSource.connect(worklet);

      // 6. Connect to VoiceLive via Express relay (handles Azure auth server-side)
      const ws = new WebSocket(VOICE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send session.update to configure the session
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['audio', 'text'],
              instructions: SYSTEM_PROMPT,
              voice: { type: 'azure_standard', name: 'de-DE-AmalaNeural' },
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: { type: 'server_vad' },
            },
          }),
        );

        // Start forwarding mic audio as base64
        worklet.port.onmessage = (ev: MessageEvent) => {
          if (ws.readyState === WebSocket.OPEN && ev.data instanceof ArrayBuffer) {
            const b64 = pcm16ToBase64(ev.data);
            ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64 }));
          }
        };

        setState('listening');
      };

      ws.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data !== 'string') return;
        try {
          const msg = JSON.parse(ev.data);
          switch (msg.type) {
            // --- Audio playback ---
            case 'response.audio.delta': {
              const pcm16 = base64ToArrayBuffer(msg.delta);
              scheduleAudioChunk(pcm16);
              if (stateRef.current !== 'speaking') setState('speaking');
              break;
            }

            // --- Assistant transcript ---
            case 'response.audio_transcript.delta': {
              const text = msg.delta || '';
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && !last.isFinal) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: last.text + text },
                  ];
                }
                return [
                  ...prev,
                  { id: uid(), role: 'assistant', text, isFinal: false, timestamp: Date.now() },
                ];
              });
              break;
            }

            // --- User transcript (final) ---
            case 'conversation.item.input_audio_transcription.completed': {
              const text = msg.transcript || '';
              if (text.trim()) {
                setTranscripts((prev) => [
                  ...prev,
                  { id: uid(), role: 'user', text, isFinal: true, timestamp: Date.now() },
                ]);
              }
              break;
            }

            // --- State transitions ---
            case 'response.created':
              // Mark current assistant transcript as final before new response
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && !last.isFinal) {
                  return [...prev.slice(0, -1), { ...last, isFinal: true }];
                }
                return prev;
              });
              setState('thinking');
              break;

            case 'response.done':
              // Finalize any pending assistant transcript
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && !last.isFinal) {
                  return [...prev.slice(0, -1), { ...last, isFinal: true }];
                }
                return prev;
              });
              setState('listening');
              break;

            case 'input_audio_buffer.speech_started':
              // Barge-in: user started speaking
              stopPlayback();
              setState('listening');
              setInterimText('');
              break;

            case 'error':
              setErrorMessage(
                msg.error?.message || 'Ein Fehler ist aufgetreten.',
              );
              setState('error');
              break;
          }
        } catch {
          /* ignore non-JSON */
        }
      };

      ws.onerror = () => {
        setErrorMessage('Verbindung zum Sprachdienst fehlgeschlagen.');
        setState('error');
      };

      ws.onclose = () => {
        if (stateRef.current !== 'idle' && stateRef.current !== 'error') {
          setState('idle');
        }
      };
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Mikrofon-Zugriff wurde verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen.'
          : err instanceof Error
            ? err.message
            : 'Sprachsitzung konnte nicht gestartet werden.';
      setErrorMessage(msg);
      setState('error');
      cleanup();
    }
  }, [cleanup, stopPlayback, scheduleAudioChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    transcripts,
    interimText,
    errorMessage,
    startSession,
    endSession,
  };
}
