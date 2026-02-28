# Increment Plan — OmasApp

## Overview

This plan breaks the OmasApp FRDs into 5 ordered vertical slices. Each increment adds user-visible functionality, can be deployed independently, and includes all layers (backend routes, frontend pages, tests, docs). The app is fully working after every increment.

### Dependency Graph

```
[1] walking-skeleton
 └──▶ [2] story-engine
       ├──▶ [3] knowledge-system
       │     └──▶ (no further deps)
       └──▶ [4] history-browsing
 └──▶ [5] voice-interaction (depends on [2])
```

### Summary Table

| # | ID | Name | Complexity | Dependencies |
|---|-----|------|-----------|-------------|
| 1 | `walking-skeleton` | Walking Skeleton | small | none |
| 2 | `story-engine` | Story Conversation Engine | medium | walking-skeleton |
| 3 | `knowledge-system` | Knowledge & Entity System | medium | story-engine |
| 4 | `history-browsing` | History Browsing | small | story-engine |
| 5 | `voice-interaction` | Voice Interaction | medium | story-engine |

---

## Increment 1: `walking-skeleton`

**Name:** Walking Skeleton

**Complexity:** small

**Goal:** Prove the architecture works end-to-end. A user can open the app, see the conversation page, type a message, and receive an echo response. Deployment infrastructure is functional.

### FRD Scope

| FRD | Sections | What's Included |
|-----|----------|-----------------|
| frd-stories.md | §2.1 (POST /sessions — stub), §2.4 (POST /messages — echo only), §3.1–3.2 (Session & Message data models), §3.3 (JSON file store — structure only), §6.1 (conversation page — shell) | Session creation (returns hardcoded welcome), message send/receive (echo, no AI), basic data model types, JSON file directory structure |
| prd.md | FR-12 (data model — Session, Message shapes), FR-14 (route `/` only) | Data model interfaces, single frontend route |

**What is NOT included:** Azure OpenAI integration, entity extraction, real AI responses, voice, history pages, knowledge queries.

### Screens

| Screen | Status | Elements Included |
|--------|--------|-------------------|
| Main Conversation Page (`/`) | **Added (shell)** | NavBar with "Omas Geschichten 💛" branding + links (history/ask/timeline lead to placeholder pages), welcome header, text input field + send button, scrollable message list (user/assistant labels), "Gespräch starten" button (creates session, shows echo welcome), "Gespräch beenden" button (stub) |

### Flows Exercised

| Flow | Steps Covered | Notes |
|------|---------------|-------|
| Flow 1: Story Conversation | Steps 1 (land on page), 2 (start — stub), 4 (text fallback — echo only) | No voice, no real AI, no entity extraction |

### Dependencies

None — this is the first increment.

### Acceptance Criteria

1. `GET /api/health` returns `{ "status": "ok" }` with HTTP 200.
2. `POST /api/stories/sessions` returns HTTP 201 with a valid session object (`id`, `startedAt`, `status: "active"`) and a hardcoded welcome message string.
3. `POST /api/stories/sessions/:id/messages` with `{ "message": "Hello" }` returns HTTP 200 with `userMessage` and `assistantMessage` where `assistantMessage.content` echoes back the user's text (e.g., "Echo: Hello").
4. `POST /api/stories/sessions/:id/messages` with empty message returns HTTP 400: `{ "error": "Message is required" }`.
5. `POST /api/stories/sessions/:id/messages` to a non-existent session returns HTTP 404: `{ "error": "Session not found" }`.
6. The frontend at `/` loads without errors and displays the NavBar with "Omas Geschichten 💛".
7. Clicking "Gespräch starten" creates a session and shows the welcome message in the chat.
8. Typing a message and pressing Enter (or clicking send) displays both the user message and the echo response in the message list.
9. Navigation links to `/history`, `/ask`, `/timeline` exist in the NavBar and render placeholder pages ("Kommt bald" / Coming soon).
10. The app can be built (`npm run build`) and started (`npm start`) without errors.
11. Body font size is ≥ 18px, touch targets are ≥ 48×48px, `lang="de"` is set on the HTML root.

---

## Increment 2: `story-engine`

**Name:** Story Conversation Engine

**Complexity:** medium

**Goal:** Replace the echo stub with a real AI conversation. Sessions persist across restarts. The AI generates contextual welcome messages (first-time vs. returning) and warm follow-up questions. The full story conversation flow works end-to-end via text.

### FRD Scope

| FRD | Sections | What's Included |
|-----|----------|-----------------|
| frd-stories.md | §2.1 (POST /sessions — full, with AI welcome), §2.2 (GET /sessions), §2.3 (GET /sessions/:id), §2.4 (POST /messages — full AI), §2.5 (GET /messages), §2.6 (POST /end — summary generation), §3 (full data model), §4 (session lifecycle), §5 (AI orchestration — personality, summaries, token budget), §7 (edge cases: empty session, long message, ended session, concurrent sends, Azure errors) | Complete session CRUD, full AI conversation with Azure OpenAI, session summaries, message persistence, error handling, retry logic |
| prd.md | US-10 (start conversation — text path), US-11 (tell a story — text path, AI listening, follow-ups, persistence), US-15 (resume conversation — context loading, welcome-back), FR-10 (sessions + messages endpoints), FR-12 (Session, Message models — full), FR-13 (AI engine — personality, summaries, token budget) | All conversation user stories (text mode), full API, full data persistence |

**What is NOT included:** Entity extraction (triggered but no-op stub), gap detection, knowledge queries, voice, history UI, timeline UI.

### Screens

| Screen | Status | Elements Included |
|--------|--------|-------------------|
| Main Conversation Page (`/`) | **Modified** | Real AI welcome message (first-time vs. returning), AI follow-up responses, "Gespräch beenden" button (triggers end + summary), error banner with retry for AI failures, last-session summary shown when no active session |

### Flows Exercised

| Flow | Steps Covered | Notes |
|------|---------------|-------|
| Flow 1: Story Conversation | Steps 1, 2 (start — full, text path), 4 (text fallback — real AI), 5 (entity extraction — stub fires but no-op), 7 (end conversation — summary), 8 (resume later) | Full text conversation flow; voice deferred; entity extraction stubbed |

### Dependencies

| Increment | Reason |
|-----------|--------|
| `walking-skeleton` | Requires the basic app shell, navigation, message list UI, and data model types |

### Acceptance Criteria

1. `POST /api/stories/sessions` calls Azure OpenAI and returns a contextual welcome message. First session: open-ended greeting. Second+ session: references details from prior sessions.
2. `POST /api/stories/sessions/:id/messages` calls Azure OpenAI with the full system prompt (personality + previous session summaries + current transcript) and returns a warm, relevant follow-up.
3. `POST /api/stories/sessions/:id/end` sets `status: "ended"`, generates a 2–3 sentence German summary via Azure OpenAI, and stores it on the session.
4. `POST /api/stories/sessions/:id/end` on an already-ended session returns HTTP 409: `{ "error": "Session is already ended" }`.
5. `GET /api/stories/sessions` returns all sessions sorted by `startedAt` descending, with pagination (`limit`, `offset`).
6. `GET /api/stories/sessions/:id` returns a single session or 404.
7. `GET /api/stories/sessions/:id/messages` returns all messages sorted by `timestamp` ascending, or 404.
8. Sessions and messages persist in `data/sessions.json` and `data/messages/{sessionId}.json`. Restarting the server preserves all data.
9. If Azure OpenAI is unavailable, `POST /sessions` returns 503 and `POST /messages` returns 503 with the documented error messages. The frontend shows an error banner with a retry button.
10. Messages exceeding 10,000 characters are rejected with 400.
11. The system prompt respects the token budget: entities placeholder (empty), summaries ≤ 20k tokens, current transcript ≤ 80k tokens. Oldest summaries are trimmed if budget is exceeded.
12. Azure OpenAI calls include retry logic (3 attempts, exponential backoff) and 30-second timeout.
13. Conversation page shows last-session summary when no active session exists.

---

## Increment 3: `knowledge-system`

**Name:** Knowledge & Entity System

**Complexity:** medium

**Goal:** After each conversation turn, entities (people, places, years, events) are extracted automatically. Decade coverage is tracked and gap detection influences the AI's questions. Family members can ask natural-language questions and receive narrative answers compiled from Oma's stories.

### FRD Scope

| FRD | Sections | What's Included |
|-----|----------|-----------------|
| frd-knowledge.md | §2.1 (GET /entities), §2.2 (GET /entities/search), §2.3 (GET /coverage), §2.4 (POST /ask), §3 (entity extraction pipeline — trigger, prompt, parsing, deduplication, storage, errors), §4 (gap detection algorithm — decade range, coverage calculation, gap identification, integration with conversation, gap question rules), §5 (knowledge query system — pipeline, prompt, source references, token budget), §6 (Entity data model, DecadeCoverage), §7 (edge cases), §8 (error catalog) | Full entity extraction, full gap detection, full knowledge query, all entity APIs |
| frd-stories.md | §5.1 (system prompt — entity context + gap hints now populated) | Entity context and gap hints injected into conversation prompt |
| prd.md | US-12 (entity extraction), US-13 (decade gaps), US-14 (knowledge queries), FR-10 (entities, search, coverage, ask endpoints), FR-12 (Entity model), FR-13 (entity extraction, gap detection, knowledge queries) | All knowledge-related user stories and functional requirements |

### Screens

| Screen | Status | Elements Included |
|--------|--------|-------------------|
| Knowledge Query Page (`/ask`) | **Added** | Search input ("Was möchten Sie wissen?"), "Fragen" submit button, example question chips, narrative answer card, source references with links to `/history/:id`, loading spinner ("Suche in Omas Geschichten..."), empty-input validation, no-results state, error/retry state |
| Timeline Page (`/timeline`) | **Added** | Horizontal decade bars (1930s–2020s), entity count per decade, coverage status coloring (green=covered, amber=thin, grey=empty), "wenig erzählt" gap labels, click-to-filter entity list per decade, empty-decade detail state |
| Main Conversation Page (`/`) | **Modified** | AI now references entity context and asks gap-filling questions (no UI change — behavior change in AI responses) |

### Flows Exercised

| Flow | Steps Covered | Notes |
|------|---------------|-------|
| Flow 1: Story Conversation | Step 5 (entity extraction — now real), Step 6 (gap question — now active) | Entity extraction fires after each message; gap hints in prompt |
| Flow 2: Knowledge Query | All steps (1–7) | Complete knowledge query flow |
| Flow 4: Timeline | All steps (1–6) | Complete timeline browsing flow |

### Dependencies

| Increment | Reason |
|-----------|--------|
| `story-engine` | Requires working session/message APIs and Azure OpenAI integration. Entity extraction depends on conversation messages existing. Knowledge queries search across stored conversations. |

### Acceptance Criteria

1. After `POST /api/stories/sessions/:id/messages`, entity extraction runs asynchronously. Entities appear in `data/entities.json` within seconds.
2. Extracted entities have valid `name`, `type` (person/year/place/event), `context`, `decade` (if inferable), and `sourceMessageIds`/`sourceSessionIds`.
3. Duplicate entities (same name, case-insensitive, same type) are merged: source arrays accumulate, longer context wins, `updatedAt` is refreshed.
4. `GET /api/stories/entities` returns all entities, supports `type`, `decade`, `limit`, `offset` filters.
5. `GET /api/stories/entities/search?q=Hans` returns entities matching by name or context (case-insensitive substring). Missing `q` returns 400.
6. `GET /api/stories/coverage` returns decade coverage for 1930s–2020s with `entityCount` and `status` (empty/thin/covered) plus a `gaps` array.
7. The conversation system prompt includes entity context and gap hints. Gap questions appear at most once per 5 turns, preferring empty decades over thin, earlier decades over later.
8. `POST /api/stories/ask` with a valid question returns a narrative German answer with source references. Empty question returns 400.
9. `POST /api/stories/ask` when no information exists returns the "no information" response with empty sources.
10. The `/ask` page validates empty input client-side, shows loading state, displays answers with source links, and handles errors.
11. The `/timeline` page renders decade bars with correct coverage status and supports click-to-filter.
12. Entity extraction failure does not block or break the conversation — errors are logged, conversation continues.

---

## Increment 4: `history-browsing`

**Name:** History Browsing

**Complexity:** small

**Goal:** Family members can browse past conversation sessions and read full transcripts with entity highlights. The history and transcript pages replace their placeholders.

### FRD Scope

| FRD | Sections | What's Included |
|-----|----------|-----------------|
| frd-stories.md | §6.2 (History page), §6.3 (Session detail page), §7 (edge cases: no sessions, not-found session) | Session list with cards, transcript view with entity chips, empty states, not-found state, pagination |
| frd-knowledge.md | §6.1 (Entity — display alongside transcript) | Entity highlight chips on transcript messages |
| prd.md | US-16 (view conversation history), FR-14 (routes `/history`, `/history/:id`) | Full history browsing user story |

**Note:** The backend APIs needed for this increment (`GET /sessions`, `GET /sessions/:id`, `GET /messages`, `GET /entities`) already exist from increments 2 and 3. This increment is frontend-only plus integration.

### Screens

| Screen | Status | Elements Included |
|--------|--------|-------------------|
| History List Page (`/history`) | **Added** | Session card list (date formatted "15. Januar 2025", summary preview, message count, duration), sorted newest-first, empty state ("Noch keine Gespräche — starten Sie das erste!" with link to `/`), "Mehr laden" pagination after 20 sessions |
| Session Transcript Page (`/history/:id`) | **Added** | Session header (date, duration, summary), full message list with timestamps and role labels (👵 Oma / 🤖 KI-Begleiterin), entity highlight chips (person=blue, place=green, year=amber, event=purple) alongside source messages, color legend, "← Zurück zum Verlauf" back link, not-found state |

### Flows Exercised

| Flow | Steps Covered | Notes |
|------|---------------|-------|
| Flow 3: History Browsing | All steps (1–6) | Complete history browsing flow |
| Flow 2: Knowledge Query | Step 5 (source reference links → transcript page) | Source links from `/ask` answers now resolve to real transcript pages |

### Dependencies

| Increment | Reason |
|-----------|--------|
| `story-engine` | Requires session and message APIs, session summaries |
| `knowledge-system` | Requires entity data for transcript highlights (could technically be optional — chips would just be empty — but the full experience requires entities) |

### Acceptance Criteria

1. `/history` page loads and displays session cards with date, summary preview (first 100 chars), message count, and duration.
2. Sessions are sorted by date, newest first.
3. If no sessions exist, the empty state message "Noch keine Gespräche — starten Sie das erste!" is shown with a link to `/`.
4. Clicking a session card navigates to `/history/:id`.
5. `/history/:id` displays the session header (date, duration, summary) and full transcript with timestamps and role labels.
6. Entity highlight chips appear alongside messages where entities were extracted, color-coded by type.
7. A color legend explains entity chip types.
8. `/history/nonexistent` shows "Gespräch nicht gefunden." with a link back to `/history`.
9. "← Zurück zum Verlauf" link navigates back to `/history`.
10. Pagination: "Mehr laden" button appears when > 20 sessions exist and loads the next page.
11. Source reference links from `/ask` answers navigate to the correct transcript page.

---

## Increment 5: `voice-interaction`

**Name:** Voice Interaction

**Complexity:** medium

**Goal:** Oma can have a hands-free voice conversation. The browser captures speech, converts it to text, sends it to the conversation API, and speaks the AI's response aloud. All voice features degrade gracefully to text-only mode on unsupported browsers.

### FRD Scope

| FRD | Sections | What's Included |
|-----|----------|-----------------|
| frd-voice.md | §2 (voice state machine — all 6 states, all transitions), §3 (STT — Web Speech API config, event handling, silence detection, error handling, browser compatibility), §4 (TTS — SpeechSynthesis config, voice selection, behavior, error handling), §5.3 (WebSocket stub), §6 (voice controls UI — layout, button states, accessibility), §7 (production path — documented only, not implemented), §8 (edge cases), §9 (error catalog) | Full voice state machine, browser STT, browser TTS, voice controls UI, WebSocket stub endpoint, all fallbacks and error handling |
| frd-stories.md | §6.1 (Main conversation page — voice controls addition) | Microphone button, voice state indicator, interim transcript |
| prd.md | US-10 (start voice conversation — mic access, state indicators, ARIA), US-11 (tell a story — continuous listening, pause detection, silence prompts, TTS), FR-11 (voice pipeline), NFR-10 (voice latency < 2s), NFR-12 (browser compatibility), NFR-14 (60-minute sessions) | All voice user stories and non-functional requirements |

### Screens

| Screen | Status | Elements Included |
|--------|--------|-------------------|
| Main Conversation Page (`/`) | **Modified** | Microphone toggle button (🎤 Mikro) with state-dependent label, voice state indicator (idle/listening/processing/thinking/speaking/error) with icons and ARIA live region, interim transcript preview (grey text), "Unterbrechen" during TTS, end-session button visibility tied to voice state, text input remains as fallback, mic permission denied modal with instructions, browser-not-supported banner |

### Flows Exercised

| Flow | Steps Covered | Notes |
|------|---------------|-------|
| Flow 1: Story Conversation | Step 2 (start — mic permission, voice state → listening), Step 3 (tell a story via voice — full STT/TTS cycle), Step 7 (end conversation — voice state → idle) | Complete voice conversation flow |

### Dependencies

| Increment | Reason |
|-----------|--------|
| `story-engine` | Voice sends text to the same `POST /sessions/:id/messages` API. Requires working AI conversation. |

### Acceptance Criteria

1. Clicking the microphone button requests browser microphone permission. On grant, voice state transitions to `listening`.
2. On permission denied, a modal shows German instructions for granting access and a "Über Tastatur schreiben" button enables text-only mode.
3. On unsupported browsers (Firefox, old Safari), the mic button is hidden, text input is promoted, and a banner recommends Chrome.
4. While in `listening` state, the pulsing green indicator is visible and interim transcript text updates in grey as Oma speaks.
5. After a 3-second pause, speech is finalized, voice state transitions through `processing` → `thinking` → `speaking`, and the AI response is read aloud via TTS.
6. After TTS completes, voice state returns to `listening` automatically (auto-resume).
7. Tapping the mic button during `speaking` cancels TTS and transitions to `listening`.
8. After 30 seconds of silence post-AI-response, a gentle prompt ("Ich bin noch da — möchten Sie weiterzählen?") is spoken via TTS.
9. After 5 minutes of silence, the session auto-ends with a farewell message.
10. The WebSocket endpoint `ws://[host]/api/voice` accepts connections and returns `{ "type": "error", "message": "Voice WebSocket is not yet implemented. Please use the REST API with browser speech." }`.
11. TTS uses a German voice at rate 0.9. If no German voice is available, the default voice is used with a one-time notice.
12. All voice state changes are announced via ARIA live regions. The mic button has correct `aria-label` and `aria-pressed` attributes.
13. Keyboard: mic toggle activatable with Space/Enter. Tab order: Mic → End → Text input.
14. Long TTS responses (> 500 chars) are chunked on sentence boundaries.
15. Voice conversations can last 60 minutes — auto-restart logic handles browser STT timeouts.

---

## Traceability Matrix

| User Story | Increment(s) | Full Coverage After |
|------------|--------------|---------------------|
| US-10: Start a Voice Conversation | 1 (shell), 2 (AI start), 5 (voice) | Increment 5 |
| US-11: Tell a Story | 1 (echo), 2 (AI conversation), 5 (voice) | Increment 5 |
| US-12: Extract Entities | 3 | Increment 3 |
| US-13: Detect Decade Gaps | 3 | Increment 3 |
| US-14: Knowledge Queries | 3 | Increment 3 |
| US-15: Resume Conversation | 2 | Increment 2 |
| US-16: View History | 3 (timeline), 4 (history/transcript) | Increment 4 |

| FRD | Increment(s) | Full Coverage After |
|-----|--------------|---------------------|
| frd-stories.md | 1, 2, 4 | Increment 4 |
| frd-knowledge.md | 3 | Increment 3 |
| frd-voice.md | 5 | Increment 5 |

| Screen | Added In | Modified In |
|--------|----------|-------------|
| Main Conversation (`/`) | 1 | 2, 3, 5 |
| History List (`/history`) | 4 | — |
| Session Transcript (`/history/:id`) | 4 | — |
| Knowledge Query (`/ask`) | 3 | — |
| Timeline (`/timeline`) | 3 | — |
