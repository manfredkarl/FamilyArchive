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

const VOICE_URL =
  process.env.NEXT_PUBLIC_VOICE_URL || 'ws://localhost:5002/ws';

const VL_SAMPLE_RATE = 24000; // VoiceLive uses 24kHz PCM16

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
  const playQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const stateRef = useRef<VoiceLiveState>('idle');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ---------- audio playback (seamless streaming) ----------

  const nextPlayTimeRef = useRef(0);

  const scheduleAudioChunk = useCallback((pcm16: ArrayBuffer) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    // Ensure even byte length for Int16Array
    const byteLen = pcm16.byteLength - (pcm16.byteLength % 2);
    if (byteLen === 0) return;

    const int16 = new Int16Array(pcm16, 0, byteLen / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    // Create buffer at VoiceLive's 24kHz — AudioContext auto-resamples to native rate
    const buffer = ctx.createBuffer(1, float32.length, VL_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Schedule seamlessly: each chunk starts right after the previous one ends
    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    isPlayingRef.current = true;
    source.onended = () => {
      // If nothing scheduled after this, we're done playing
      if (ctx.currentTime >= nextPlayTimeRef.current - 0.01) {
        isPlayingRef.current = false;
      }
    };
  }, []);

  const stopPlayback = useCallback(() => {
    playQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
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
    stopPlayback();
  }, [stopPlayback]);

  // ---------- endSession ----------

  const endSession = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'end' }));
      } catch { /* ignore */ }
    }
    cleanup();
    setState('idle');
    setInterimText('');
  }, [cleanup]);

  // ---------- startSession ----------

  const startSession = useCallback(async () => {
    // Reset
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

      // 5. Connect mic → worklet (captures at native rate, worklet resamples to 24kHz)
      const source = captureCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const worklet = new AudioWorkletNode(captureCtx, 'pcm16-capture');
      workletNodeRef.current = worklet;
      source.connect(worklet);

      // 6. WebSocket to VoiceLive proxy
      const ws = new WebSocket(VOICE_URL);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        // Start forwarding mic audio
        worklet.port.onmessage = (ev: MessageEvent) => {
          if (ws.readyState === WebSocket.OPEN && ev.data instanceof ArrayBuffer) {
            ws.send(new Uint8Array(ev.data));
          }
        };
      };

      ws.onmessage = (ev: MessageEvent) => {
        // Binary frame = raw PCM16 audio from VoiceLive
        if (ev.data instanceof ArrayBuffer) {
          scheduleAudioChunk(ev.data);
          if (stateRef.current !== 'speaking') setState('speaking');
          return;
        }

        // Text frame = JSON control/transcript message
        if (typeof ev.data !== 'string') return;
        try {
          const msg = JSON.parse(ev.data);
          switch (msg.type) {
            case 'status':
              if (msg.status === 'listening') setState('listening');
              else if (msg.status === 'thinking') setState('thinking');
              else if (msg.status === 'speaking') setState('speaking');
              break;

            case 'transcript': {
              const entry: TranscriptEntry = {
                id: uid(),
                role: msg.role,
                text: msg.text,
                isFinal: msg.isFinal,
                timestamp: Date.now(),
              };
              if (!msg.isFinal && msg.role === 'user') {
                setInterimText(msg.text);
              } else {
                setInterimText('');
                setTranscripts((prev) => {
                  // Replace last interim from same role if not final
                  const last = prev[prev.length - 1];
                  if (last && !last.isFinal && last.role === entry.role) {
                    return [...prev.slice(0, -1), entry];
                  }
                  return [...prev, entry];
                });
              }
              // Barge-in: user starts speaking while AI is playing
              if (msg.role === 'user' && stateRef.current === 'speaking') {
                stopPlayback();
                setState('listening');
              }
              break;
            }

            case 'error':
              setErrorMessage(msg.message || 'Ein Fehler ist aufgetreten.');
              setState('error');
              break;
          }
        } catch { /* ignore non-JSON */ }
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
