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
  (typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_VOICE_URL) ||
  process.env.NEXT_PUBLIC_VOICE_URL ||
  'ws://localhost:5002/ws';

const SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096; // samples per worklet frame

/**
 * PCM16-capture AudioWorklet processor (inline, registered via Blob URL).
 * Captures mono 24 kHz PCM16 from the mic and posts ArrayBuffers to the main thread.
 */
const WORKLET_SOURCE = `
class Pcm16CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const float32 = input[0];
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const stateRef = useRef<VoiceLiveState>('idle');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ---------- audio playback ----------

  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || playQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;

    const pcm16 = playQueueRef.current.shift()!;
    // Ensure even byte length for Int16Array (PCM16 = 2 bytes per sample)
    const byteLen = pcm16.byteLength - (pcm16.byteLength % 2);
    if (byteLen === 0) {
      playNextChunk();
      return;
    }
    const int16 = new Int16Array(pcm16, 0, byteLen / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    const buffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => playNextChunk();
    source.start();
  }, []);

  const enqueueAudio = useCallback(
    (b64: string) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      playQueueRef.current.push(bytes.buffer);
      if (!isPlayingRef.current) playNextChunk();
    },
    [playNextChunk],
  );

  const stopPlayback = useCallback(() => {
    playQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  // ---------- cleanup ----------

  const cleanup = useCallback(() => {
    // WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }

    // AudioWorklet + mic
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch { /* ignore */ }
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch { /* ignore */ }
      sourceNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch { /* ignore */ }
      audioCtxRef.current = null;
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
      // 1. Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      // 2. AudioContext
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      // 3. Register worklet
      const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // 4. Connect mic → worklet
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const worklet = new AudioWorkletNode(audioCtx, 'pcm16-capture', {
        processorOptions: { bufferSize: BUFFER_SIZE },
      });
      workletNodeRef.current = worklet;
      source.connect(worklet);
      // worklet doesn't need to connect to destination (capture only)

      // 5. WebSocket
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
          playQueueRef.current.push(ev.data);
          if (!isPlayingRef.current) playNextChunk();
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
  }, [cleanup, stopPlayback]);

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
