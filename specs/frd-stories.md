# FRD-STORIES: Story Capture & Conversation Management

**Covers:** US-10, US-11, US-15, US-16
**Depends on:** FRD-Voice (voice input/output layer), FRD-Knowledge (entity extraction, gap detection)

---

## 1. Overview

This FRD specifies the story conversation system — the core of OmasApp. It covers creating and resuming conversation sessions, exchanging messages with the AI interviewer, persisting transcripts, generating session summaries, and browsing conversation history. The Express.js TypeScript API manages session lifecycle and orchestrates calls to Azure OpenAI for conversation responses.

---

## 2. API Contracts

### 2.1 POST /api/stories/sessions

Creates a new conversation session. The AI generates a warm welcome message, referencing past stories if any exist.

**Request Body:** None (empty body or `{}`).

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 201 | Session created | `{ "session": { ... }, "welcomeMessage": "..." }` |
| 503 | Azure OpenAI unavailable | `{ "error": "AI service is currently unavailable. Please try again." }` |
| 500 | Unexpected error | `{ "error": "Internal server error" }` |

**201 Example:**

```json
{
  "session": {
    "id": "sess_abc123",
    "startedAt": "2025-01-15T14:30:00.000Z",
    "endedAt": null,
    "summary": null,
    "messageCount": 1,
    "status": "active"
  },
  "welcomeMessage": "Hallo! Schön, dass wir wieder zusammen plaudern. Letztes Mal haben Sie mir von Ihrem Garten in Heidelberg erzählt — möchten Sie mir noch mehr davon erzählen, oder fällt Ihnen heute etwas anderes ein?"
}
```

The welcome message is also stored as the first `assistant` message in the session.

---

### 2.2 GET /api/stories/sessions

Lists all conversation sessions, sorted by `startedAt` descending (newest first).

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | no | 20 | Max sessions to return (1–100) |
| `offset` | integer | no | 0 | Pagination offset |

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | `{ "sessions": [...], "total": 42 }` |

**200 Example:**

```json
{
  "sessions": [
    {
      "id": "sess_abc123",
      "startedAt": "2025-01-15T14:30:00.000Z",
      "endedAt": "2025-01-15T15:10:00.000Z",
      "summary": "Oma erzählte von ihrer Kindheit in Heidelberg in den 1950er Jahren...",
      "messageCount": 24,
      "status": "ended"
    }
  ],
  "total": 1
}
```

If no sessions exist, returns `{ "sessions": [], "total": 0 }`.

---

### 2.3 GET /api/stories/sessions/:id

Returns a single session's metadata.

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Session found | `{ "session": { ... } }` |
| 404 | Session not found | `{ "error": "Session not found" }` |

---

### 2.4 POST /api/stories/sessions/:id/messages

Sends a user message and returns the AI's response. Entity extraction is triggered asynchronously after the response is returned.

**Request Body:**

```json
{
  "message": "Ja, ich erinnere mich an den großen Apfelbaum im Garten..."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `message` | string | yes | Non-empty, max 10,000 characters |

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | `{ "userMessage": { ... }, "assistantMessage": { ... } }` |
| 400 | Empty or missing message | `{ "error": "Message is required" }` |
| 400 | Message too long | `{ "error": "Message must not exceed 10000 characters" }` |
| 404 | Session not found | `{ "error": "Session not found" }` |
| 409 | Session already ended | `{ "error": "Cannot send messages to an ended session" }` |
| 503 | Azure OpenAI unavailable | `{ "error": "AI service is currently unavailable. Please try again." }` |
| 500 | Unexpected error | `{ "error": "Internal server error" }` |

**200 Example:**

```json
{
  "userMessage": {
    "id": "msg_001",
    "sessionId": "sess_abc123",
    "role": "user",
    "content": "Ja, ich erinnere mich an den großen Apfelbaum im Garten...",
    "timestamp": "2025-01-15T14:32:00.000Z"
  },
  "assistantMessage": {
    "id": "msg_002",
    "sessionId": "sess_abc123",
    "role": "assistant",
    "content": "Oh, ein Apfelbaum! Das klingt wunderbar. Haben Sie als Kind dort gespielt?",
    "timestamp": "2025-01-15T14:32:01.500Z"
  }
}
```

**Behavior:**
1. Validate message is non-empty and within length limit.
2. Validate session exists and has `status: "active"`.
3. Persist the user message immediately.
4. Build the AI prompt (see §5) and call Azure OpenAI.
5. Persist the assistant message immediately.
6. Trigger entity extraction asynchronously (fire-and-forget; see FRD-Knowledge).
7. Return both messages.

---

### 2.5 GET /api/stories/sessions/:id/messages

Returns all messages for a session, sorted by `timestamp` ascending.

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | `{ "messages": [...] }` |
| 404 | Session not found | `{ "error": "Session not found" }` |

Returns `{ "messages": [] }` for a session with no messages (should not happen in practice since session creation adds a welcome message).

---

### 2.6 POST /api/stories/sessions/:id/end

Ends a conversation session. Triggers summary generation via Azure OpenAI.

**Request Body:** None.

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Session ended | `{ "session": { ... } }` |
| 404 | Session not found | `{ "error": "Session not found" }` |
| 409 | Already ended | `{ "error": "Session is already ended" }` |
| 503 | Azure OpenAI unavailable (summary generation failed) | `{ "error": "Session ended but summary generation failed. It will be retried." }` |

**Behavior:**
1. Set `endedAt` to current timestamp.
2. Set `status` to `"ended"`.
3. Generate summary via Azure OpenAI using the full session transcript.
4. Store the summary on the session.
5. If summary generation fails, the session is still marked as ended; summary can be generated later.

---

## 3. Data Model

### 3.1 Session

```typescript
interface Session {
  id: string;           // Format: "sess_" + nanoid(12)
  startedAt: string;    // ISO 8601
  endedAt: string | null;
  summary: string | null;
  messageCount: number;
  status: 'active' | 'ended';
}
```

### 3.2 Message

```typescript
interface Message {
  id: string;           // Format: "msg_" + nanoid(12)
  sessionId: string;    // References Session.id
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;    // ISO 8601
}
```

### 3.3 Storage (MVP)

- Sessions stored in `data/sessions.json` as an array.
- Messages stored in `data/messages/{sessionId}.json` — one file per session.
- All writes are synchronous (write-then-respond) to prevent data loss.
- File writes use atomic write pattern: write to temp file, then rename.

---

## 4. Session Lifecycle

```
[No sessions] ──POST /sessions──▶ [Active session]
                                       │
                          POST /:id/messages (repeats)
                                       │
                          POST /:id/end─▶ [Ended session]
```

### 4.1 Session State Rules

| Current State | Allowed Actions |
|---------------|-----------------|
| `active` | Send messages, end session |
| `ended` | Read messages, read session (no new messages) |

---

## 5. AI Conversation Orchestration

### 5.1 System Prompt Structure

The system prompt sent to Azure OpenAI for conversation responses is composed of these sections:

1. **Personality instructions:** Defines the AI as a warm, patient interviewer who speaks German. Instructs it to acknowledge what was said, ask gentle follow-ups, never interrupt, and be comfortable with silence.
2. **Entity context:** All previously extracted entities as a compact JSON array (see FRD-Knowledge for entity format).
3. **Previous session summaries:** Summaries from all prior ended sessions, ordered chronologically.
4. **Gap analysis hint:** If any decades are "thin" (< 3 entities), include a hint suggesting the AI work in a question about that decade (max one gap question per 5 turns).
5. **Current session transcript:** All messages from the current session.

### 5.2 Token Budget Management

- **Model:** Azure OpenAI GPT-4o (128k context window).
- **Budget allocation:** Personality (500 tokens) + Entities (up to 10k tokens) + Summaries (up to 20k tokens) + Current transcript (up to 80k tokens) + Response (up to 4k tokens).
- **Overflow strategy:** If total input exceeds 110k tokens, trim oldest session summaries first. If still over, summarize the oldest messages in the current session transcript.

### 5.3 Summary Generation

When a session ends, a separate Azure OpenAI call generates a summary:
- Input: Full session transcript.
- Instruction: "Summarize this conversation in 2–3 sentences in German. Highlight the key stories, people, places, and time periods discussed."
- Max output: 300 tokens.

---

## 6. Frontend Pages

### 6.1 Main Conversation Page (`/`)

| Element | Detail |
|---------|--------|
| Route | `/` |
| Primary CTA | "Gespräch starten" button — large (min 48×48 px), centered, high contrast |
| During conversation | Split view: transcript on left/top, voice controls on right/bottom |
| Transcript | Scrollable list of messages with role indicators (Oma / AI) |
| Voice controls | Mic toggle, state indicator (idle/listening/thinking/speaking), end conversation button |
| Text fallback | Text input field always visible below voice controls |
| End conversation | "Gespräch beenden" button — triggers POST /:id/end |
| Empty state (no active session) | Shows the start button and, if past sessions exist, a brief summary of the last conversation |
| Error state | If AI service fails: "Der KI-Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es erneut." with retry button |

### 6.2 History Page (`/history`)

| Element | Detail |
|---------|--------|
| Route | `/history` |
| Session list | Cards showing: date (formatted as "15. Januar 2025"), duration, summary preview (first 100 chars) |
| Empty state | "Noch keine Gespräche — starten Sie das erste!" with link to `/` |
| Pagination | Load more button after 20 sessions |
| Click action | Navigate to `/history/:id` |

### 6.3 Session Detail Page (`/history/:id`)

| Element | Detail |
|---------|--------|
| Route | `/history/:id` |
| Transcript | Full message list with timestamps and role labels |
| Entity highlights | Extracted entities shown as colored chips alongside their source messages |
| Session metadata | Date, duration, summary at the top |
| Not found | If session ID is invalid: "Gespräch nicht gefunden." with link back to `/history` |

### 6.4 Timeline Page (`/timeline`)

| Element | Detail |
|---------|--------|
| Route | `/timeline` |
| Visualization | Horizontal bar chart showing entity count per decade (1930s–2020s) |
| Gap indicators | Decades with < 3 entities highlighted in a muted color with "wenig erzählt" (few stories) label |
| Click action | Clicking a decade filters the entity list to show entities from that decade |

### 6.5 Ask Page (`/ask`)

| Element | Detail |
|---------|--------|
| Route | `/ask` |
| Input | Text field with placeholder: "Was möchten Sie wissen?" (What would you like to know?) |
| Submit | "Fragen" button (min 48×48 px touch target) |
| Validation | Empty input shows inline message: "Bitte stellen Sie eine Frage." |
| Answer display | Narrative answer with source references (links to session detail pages) |
| No results | "Dazu habe ich leider noch keine Informationen. Fragen Sie Oma beim nächsten Gespräch!" |
| Loading | Spinner with "Suche in Omas Geschichten..." (Searching Oma's stories...) |
| Error | "Die Suche ist gerade nicht möglich. Bitte versuchen Sie es erneut." with retry button |

### 6.6 Accessibility Requirements (All Pages)

| Requirement | Detail |
|-------------|--------|
| Font size | Minimum 18px for body text, 24px+ for headings |
| Contrast | WCAG 2.1 AA — minimum 4.5:1 for normal text, 3:1 for large text |
| Touch targets | Minimum 48×48 px for all interactive elements |
| Keyboard | All interactive elements focusable and operable via keyboard (Tab, Enter, Space, Escape) |
| Focus indicators | Visible focus ring on all focusable elements (min 2px, contrasting color) |
| Screen readers | ARIA live regions for conversation state changes; landmark roles for page structure |
| Motion | Respect `prefers-reduced-motion` for any animations |
| Language | `lang="de"` on the HTML root element |

---

## 7. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| No sessions exist | GET /sessions returns `{ "sessions": [], "total": 0 }`. Main page shows start button only. History page shows empty state. |
| Session with zero user messages | Possible if user starts and immediately ends. Session has only the welcome message. Summary reflects this: "Kurzes Gespräch ohne geteilte Geschichten." |
| Very long message (> 10,000 chars) | Rejected with 400: "Message must not exceed 10000 characters" |
| Empty message (`""` or whitespace only) | Rejected with 400: "Message is required" |
| Send message to non-existent session | 404: "Session not found" |
| Send message to ended session | 409: "Cannot send messages to an ended session" |
| End an already-ended session | 409: "Session is already ended" |
| Network disconnect during message send | Frontend retries up to 2 times. If all fail, shows error with retry button. No duplicate messages: client sends a client-generated request ID for idempotency. |
| Azure OpenAI timeout (> 30s) | Returns 503. Client shows error with retry button. |
| Azure OpenAI returns empty response | Treated as error. AI response defaults to: "Entschuldigung, ich konnte Sie gerade nicht ganz verstehen. Könnten Sie das noch einmal sagen?" |
| Concurrent message sends to same session | Requests are serialized per session (in-memory lock). Second request waits for first to complete. |
| Invalid session ID format | 404: "Session not found" (no special handling — just not found in store). |
| Session summary generation fails | Session is still ended. Summary is set to `null`. A background process retries summary generation for sessions with `null` summary. |

---

## 8. Error Catalog

| Endpoint | Status | Error Message |
|----------|--------|---------------|
| POST /api/stories/sessions | 503 | "AI service is currently unavailable. Please try again." |
| POST /api/stories/sessions/:id/messages | 400 | "Message is required" |
| POST /api/stories/sessions/:id/messages | 400 | "Message must not exceed 10000 characters" |
| POST /api/stories/sessions/:id/messages | 404 | "Session not found" |
| POST /api/stories/sessions/:id/messages | 409 | "Cannot send messages to an ended session" |
| POST /api/stories/sessions/:id/messages | 503 | "AI service is currently unavailable. Please try again." |
| GET /api/stories/sessions/:id | 404 | "Session not found" |
| GET /api/stories/sessions/:id/messages | 404 | "Session not found" |
| POST /api/stories/sessions/:id/end | 404 | "Session not found" |
| POST /api/stories/sessions/:id/end | 409 | "Session is already ended" |
| POST /api/stories/sessions/:id/end | 503 | "Session ended but summary generation failed. It will be retried." |
| Any endpoint | 500 | "Internal server error" |

All errors use the shape: `{ "error": "<message>" }`.

---

## 9. Traceability

| User Story | PRD Reference | Covered In |
|------------|---------------|------------|
| US-10 | Start a Voice Conversation | §2.1, §5, §6.1, §7 |
| US-11 | Tell a Story | §2.4, §5, §6.1, §7 |
| US-15 | Resume a Conversation | §2.1 (returning session), §5.1 (summaries + entities in context), §7 |
| US-16 | View Conversation History | §2.2, §2.3, §2.5, §6.2, §6.3, §6.4, §7 |
