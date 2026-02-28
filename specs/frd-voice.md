# FRD-VOICE: Voice Interaction Layer

**Covers:** US-10 (voice aspects), US-11 (voice aspects)
**Depends on:** FRD-Stories (session and message APIs)

---

## 1. Overview

This FRD specifies the voice interaction layer for OmasApp. The voice pipeline converts Oma's speech to text, sends it to the conversation API, and speaks the AI's response aloud. The MVP uses browser-native Web Speech APIs (SpeechRecognition for STT, SpeechSynthesis for TTS). The production path upgrades to Azure Speech SDK and eventually Azure VoiceLive for lower latency and higher accuracy. The voice layer is a frontend-only concern in the MVP — the backend API always works with text.

---

## 2. Voice State Machine

The voice interaction follows a strict state machine. Only one state is active at any time.

### 2.1 States

| State | Description | Visual Indicator | ARIA Announcement |
|-------|-------------|------------------|-------------------|
| `idle` | No conversation active. Mic is off. | Grey microphone icon | "Bereit zum Starten" (Ready to start) |
| `listening` | Mic is active, capturing speech. | Pulsing green circle around mic | "Ich höre zu" (I'm listening) |
| `processing` | Speech captured, waiting for transcript finalization. | Animated dots | "Verarbeite Sprache" (Processing speech) |
| `thinking` | Text sent to API, waiting for AI response. | Animated brain/gear icon | "Denke nach" (Thinking) |
| `speaking` | AI response is being read aloud via TTS. | Animated speaker icon | "Spreche Antwort" (Speaking response) |
| `error` | Something went wrong. | Red indicator with message | Error message read aloud |

### 2.2 Transitions

```
idle ──[Start button]──▶ listening
listening ──[Speech pause detected]──▶ processing
processing ──[Transcript finalized]──▶ thinking
thinking ──[AI response received]──▶ speaking
speaking ──[TTS complete]──▶ listening (auto-resume)
speaking ──[User interrupts / taps mic]──▶ listening (cancel TTS)

Any state ──[End conversation]──▶ idle
Any state ──[Error]──▶ error
error ──[Retry / dismiss]──▶ idle or listening
```

### 2.3 State Persistence

Voice state is client-side only and is not persisted. If the page reloads, state returns to `idle`. The conversation transcript is already persisted server-side.

---

## 3. Speech-to-Text (STT)

### 3.1 MVP: Browser Web Speech API

**API:** `window.SpeechRecognition` (or `webkitSpeechRecognition`)

**Configuration:**

| Property | Value | Rationale |
|----------|-------|-----------|
| `continuous` | `true` | Allow long-form speaking without manual restarts |
| `interimResults` | `true` | Show real-time transcript preview while Oma speaks |
| `lang` | `"de-DE"` | German (Germany) as default; configurable |
| `maxAlternatives` | `1` | Use best result only |

**Event Handling:**

| Event | Action |
|-------|--------|
| `onresult` (interim) | Display interim transcript in the UI (grey text, updated in place) |
| `onresult` (final) | Transition to `processing` → then `thinking`. Send finalized text to API. |
| `onspeechend` | If no final result within 2 seconds, restart recognition (browser may stop prematurely) |
| `onerror` | Handle by error type (see §3.3) |
| `onend` | If state is `listening`, restart recognition (browsers auto-stop after silence) |

### 3.2 Silence Detection

- **Short pause (3 seconds):** Finalize the current speech segment and send to API.
- **Extended silence (30 seconds):** After the AI's last response, if no speech is detected for 30 seconds, the AI sends a gentle prompt via TTS: "Ich bin noch da — möchten Sie weiterzählen?" (I'm still here — would you like to continue?)
- **Very long silence (5 minutes):** Auto-end the session with a friendly farewell message. This prevents sessions from running indefinitely if Oma walks away.

### 3.3 Error Handling

| Error Type | User-Visible Behavior | Recovery |
|------------|----------------------|----------|
| `not-allowed` | "Mikrofon-Zugriff wurde verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen." Displayed as a modal with instructions. | Offer text-input fallback. Show "Über Tastatur schreiben" (Type instead) button. |
| `no-speech` | No visible error — restart recognition silently. | Auto-restart after 1 second. |
| `audio-capture` | "Mikrofon nicht gefunden. Bitte schließen Sie ein Mikrofon an." | Offer text-input fallback. |
| `network` | "Spracherkennung nicht verfügbar. Bitte prüfen Sie Ihre Internetverbindung." | Offer text-input fallback and retry button. |
| `aborted` | No visible error — normal during state transitions. | No action needed. |
| `service-not-available` | "Spracherkennung wird von diesem Browser nicht unterstützt. Bitte verwenden Sie Chrome." | Enable text-only mode automatically. |

### 3.4 Browser Compatibility

| Browser | SpeechRecognition Support | Fallback |
|---------|--------------------------|----------|
| Chrome 33+ | ✅ Full support (via `webkitSpeechRecognition`) | — |
| Edge 79+ | ✅ Full support | — |
| Firefox | ❌ Not supported | Text-only mode |
| Safari 14.1+ | ⚠️ Partial (no `continuous` mode) | Restart after each utterance; degrade gracefully |

On unsupported browsers, the voice button is hidden and the text input is promoted as the primary interface. A banner reads: "Spracheingabe ist in diesem Browser nicht verfügbar. Bitte verwenden Sie Chrome für die beste Erfahrung." (Voice input is not available in this browser. Please use Chrome for the best experience.)

---

## 4. Text-to-Speech (TTS)

### 4.1 MVP: Browser SpeechSynthesis API

**API:** `window.speechSynthesis`

**Configuration:**

| Property | Value | Rationale |
|----------|-------|-----------|
| `lang` | `"de-DE"` | Match input language |
| `rate` | `0.9` | Slightly slower than default for elderly listeners |
| `pitch` | `1.0` | Natural pitch |
| `voice` | Best available German female voice | Warm, friendly tone; fall back to default if no German voice available |

**Voice Selection Logic:**
1. Get all voices via `speechSynthesis.getVoices()`.
2. Filter for `lang` starting with `"de"`.
3. Prefer voices with `localService: true` (less latency).
4. If no German voice is found, use the default voice and log a warning.

### 4.2 TTS Behavior

| Scenario | Behavior |
|----------|----------|
| AI response received | Automatically start speaking. Transition to `speaking` state. |
| TTS completes | Transition to `listening` state. Resume mic. |
| User taps mic during TTS | Cancel TTS (`speechSynthesis.cancel()`), transition to `listening`. |
| Long AI response (> 500 chars) | Speak in chunks split on sentence boundaries to avoid TTS buffer issues. |
| TTS not available | Display text response visually. No audio. Log warning. |

### 4.3 TTS Error Handling

| Error | Behavior |
|-------|----------|
| `speechSynthesis.speaking` stuck | Timeout after 60 seconds. Cancel and show text. |
| No German voice available | Use default voice. Show one-time notice: "Deutsche Stimme nicht verfügbar." |
| `onerror` event | Log error. Display text response. Transition to `listening`. |

---

## 5. WebSocket Endpoint (Future: Azure VoiceLive)

### 5.1 Endpoint

`ws://[host]/api/voice`

### 5.2 Protocol (Planned — Not Implemented in MVP)

**Client → Server Messages:**

```json
{ "type": "audio_chunk", "data": "<base64 audio>", "sessionId": "sess_abc123" }
{ "type": "start_session", "sessionId": "sess_abc123" }
{ "type": "end_session", "sessionId": "sess_abc123" }
```

**Server → Client Messages:**

```json
{ "type": "interim_transcript", "text": "Ich erinnere mich..." }
{ "type": "final_transcript", "text": "Ich erinnere mich an den Apfelbaum." }
{ "type": "ai_response_text", "text": "Oh, ein Apfelbaum! Erzählen Sie mir mehr." }
{ "type": "ai_response_audio", "data": "<base64 audio>" }
{ "type": "error", "message": "..." }
```

### 5.3 MVP Stub

In the MVP, the WebSocket endpoint accepts connections but immediately sends:

```json
{ "type": "error", "message": "Voice WebSocket is not yet implemented. Please use the REST API with browser speech." }
```

This ensures the endpoint exists for future integration without breaking clients.

---

## 6. Voice Controls UI Component

### 6.1 Layout

```
┌─────────────────────────────────────────┐
│                                         │
│         [State Indicator Icon]          │
│         "Ich höre zu..."                │
│                                         │
│    ┌────────────┐  ┌────────────────┐   │
│    │  🎤 Mikro  │  │ ⏹ Beenden     │   │
│    │  (toggle)  │  │ (end session)  │   │
│    └────────────┘  └────────────────┘   │
│                                         │
│    ┌────────────────────────────────┐   │
│    │  Text-Eingabe (Fallback)       │   │
│    └────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 6.2 Button States

| Button | State: idle | State: listening | State: thinking | State: speaking |
|--------|-------------|-----------------|-----------------|-----------------|
| Mic toggle | "Mikrofon an" (Start mic) | "Mikrofon aus" (Stop mic) | Disabled | "Unterbrechen" (Interrupt) |
| End session | Hidden | Visible | Visible | Visible |
| Text input | Visible, focused | Visible, secondary | Disabled | Disabled |

### 6.3 Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Mic button | `role="button"`, `aria-label` reflects current action, `aria-pressed` for toggle state |
| State indicator | `aria-live="polite"` region updated on each state change |
| Interim transcript | `aria-live="off"` (too frequent for screen readers) |
| Final transcript | `aria-live="polite"` announces new messages |
| Keyboard | Mic toggle: Space/Enter. End session: Space/Enter. Tab order: Mic → End → Text input |
| Focus management | After TTS completes, focus returns to mic button |

---

## 7. Production Path: Azure Speech SDK

### 7.1 Migration Plan

When upgrading from browser Web Speech API to Azure Speech SDK:

| Aspect | Browser API (MVP) | Azure Speech SDK (Production) |
|--------|-------------------|-------------------------------|
| STT accuracy | Varies by browser/OS | Consistently high with custom models |
| Language support | Limited to browser's language packs | Full Azure language support |
| Continuous mode | Unreliable in Safari | Reliable across all platforms |
| Latency | Higher (round-trip to Google/Apple servers) | Lower (Azure region proximity) |
| Cost | Free | Per-minute billing |
| Privacy | Audio sent to Google/Apple | Audio sent to Azure (within compliance boundary) |

### 7.2 Azure Speech SDK Configuration (Planned)

```typescript
const speechConfig = SpeechConfig.fromSubscription(
  process.env.AZURE_SPEECH_KEY,
  process.env.AZURE_SPEECH_REGION
);
speechConfig.speechRecognitionLanguage = "de-DE";
speechConfig.speechSynthesisVoiceName = "de-DE-KatjaNeural";
```

---

## 8. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Mic permission denied | Show permission instructions modal. Enable text-only mode. Do not block the conversation. |
| Mic permission revoked mid-conversation | Detect via `onerror`. Show notification. Switch to text-only mode. Current session continues. |
| Browser does not support SpeechRecognition | Hide mic button. Show text-only mode with browser recommendation banner. |
| Poor audio quality / low confidence | Web Speech API does not expose confidence scores in `continuous` mode. Accept all final results. Users can correct via text input. |
| Very long speech (> 2 minutes continuous) | Browser may auto-segment. Handle each segment as a separate `onresult` event. Concatenate segments before sending to API. |
| Oma speaks multiple languages in one turn | Web Speech API attempts recognition in the configured `lang`. Mixed-language recognition is unreliable — accept best-effort result. |
| TTS voice changes after browser update | Re-select voice on each session start. If previously selected voice is unavailable, fall back gracefully. |
| Two tabs open with active sessions | Each tab has independent voice state. Mic access may conflict. Second tab shows error and falls back to text. |
| Device has no microphone | `audio-capture` error on start. Text-only mode enabled automatically. |
| User interrupts TTS by tapping mic | Cancel TTS immediately. Transition to `listening`. No partial response issue — full AI text is already saved. |
| 60-minute session | Web Speech API may stop intermittently. Auto-restart logic (§3.1) handles this. Session transcript persisted server-side regardless. |
| Safari `continuous` mode limitation | Detect Safari user agent. Use non-continuous mode with auto-restart after each utterance. Slightly degraded UX but functional. |
| Mobile device locks screen during conversation | Audio stops. On unlock, state returns to `idle`. User must tap mic to resume. Conversation is not lost. |

---

## 9. Error Catalog

| Component | Error Condition | User Message (German) | Recovery |
|-----------|----------------|----------------------|----------|
| STT | Permission denied | "Mikrofon-Zugriff wurde verweigert." | Text fallback |
| STT | No microphone | "Mikrofon nicht gefunden." | Text fallback |
| STT | Network error | "Spracherkennung nicht verfügbar." | Text fallback + retry |
| STT | Browser not supported | "Spracheingabe in diesem Browser nicht verfügbar." | Text-only mode |
| TTS | No German voice | "Deutsche Stimme nicht verfügbar." | Default voice |
| TTS | Synthesis failed | (silent) | Text display only |
| TTS | Synthesis timeout (60s) | (silent) | Cancel, display text |
| WebSocket | Connection failed | "Echtzeit-Verbindung nicht möglich." | Fall back to REST API |

---

## 10. Traceability

| User Story | PRD Reference | Covered In |
|------------|---------------|------------|
| US-10 (voice) | Start a Voice Conversation — mic access, state indicators | §2, §3, §6, §8 |
| US-11 (voice) | Tell a Story — continuous listening, pause detection, TTS | §3, §4, §6, §8 |
| NFR-10 | Voice latency < 2s | §3.1 (STT config), §4.2 (TTS auto-start) |
| NFR-12 | Browser compatibility | §3.4 |
| NFR-13 | Elderly-friendly UI | §6.2 (large buttons), §6.3 (accessibility) |
| NFR-14 | 60-minute sessions | §8 (auto-restart logic) |
| NFR-16 | Keyboard accessibility | §6.3 |
