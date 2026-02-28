# Product Requirements Document — OmasApp (Family Story Preservation)

## 1. Overview

OmasApp is a conversational AI application that helps families preserve their stories and memories through natural voice conversations with grandma ("Oma"). The app uses Azure's voice and AI services to conduct warm, patient interviews — capturing stories, extracting key details (people, places, dates, events), and building a searchable family knowledge base over time. Family members can later ask "What do you know about X?" and receive answers drawn from Oma's own words.

## 2. User Personas

### Oma (Primary Storyteller)
- **Age:** 70–95 years old
- **Tech comfort:** Low — may not own a smartphone; needs the simplest possible interface
- **Physical considerations:** May have reduced vision, hearing, or fine motor skills
- **Language:** German (primary); may use dialect or mix languages
- **Goal:** Share memories naturally, as if talking to a patient grandchild

### Family Member (Listener / Researcher)
- **Age:** 25–60 years old
- **Tech comfort:** Moderate to high — comfortable with web apps
- **Language:** German or English
- **Goal:** Capture Oma's stories before they're lost; browse and search the family knowledge base

### Setup Helper (One-time role)
- **Tech comfort:** High — sets up and maintains the app instance
- **Goal:** Deploy the app and ensure it works on Oma's device (typically a tablet with Chrome)

## 3. Goals

- Provide a frictionless, voice-first interface that feels like a natural conversation — not technology.
- Capture and permanently store every story Oma shares, with full transcripts.
- Automatically extract entities (people, years, places, events) and organize them by decade.
- Detect gaps in the family timeline and gently prompt Oma to share more about under-represented periods.
- Allow anyone in the family to ask questions and retrieve knowledge from the collected stories.
- Resume conversations seamlessly — always remembering what was already shared.

## 4. User Stories

### US-10: Start a Voice Conversation
**As a** family member,  
**I want to** start a voice conversation with the story-preservation AI,  
**So that** Oma can simply talk and share her memories hands-free.

**Acceptance Criteria:**
- The main page shows a large, prominent "Gespräch starten" (Start Conversation) button with a minimum touch target of 48×48 px.
- Clicking the button requests microphone access and begins listening.
- If microphone permission is denied, the app shows a friendly message explaining how to grant permission, and offers the text-input fallback.
- If the browser does not support Web Speech API, the app shows a message recommending Chrome and enables text-only mode.
- The AI greets Oma warmly and asks an open-ended question to start.
- If this is a returning session, the AI references previous stories and continues from where they left off.
- Visual indicators show the current state: idle, listening, thinking, or speaking.
- All state indicators have both visual and ARIA live-region announcements for screen reader users.
- The start button is keyboard-accessible (focusable, activatable with Enter/Space).

### US-11: Tell a Story
**As** Oma,  
**I want to** talk freely about my memories while the AI listens patiently,  
**So that** my stories are captured exactly as I tell them.

**Acceptance Criteria:**
- The AI listens continuously without interrupting.
- After Oma pauses (silence threshold: 3 seconds), the AI acknowledges what was said and asks a gentle follow-up question.
- Extended silence (> 30 seconds) triggers a gentle prompt: "Ich bin noch da — möchten Sie weiterzählen?" (I'm still here — would you like to continue?).
- The full transcript is saved after each exchange (each user message and AI response persisted individually).
- Oma can speak for as long as she wants — there is no time limit per turn.
- The conversation can also happen via text input as a fallback.
- If the AI service (Azure OpenAI) is unavailable, the app displays a friendly error message and offers to retry.
- If the network disconnects mid-conversation, unsent messages are queued and the user is notified.
- The AI response latency target is < 2 seconds from end of speech to start of AI response.

### US-12: Extract Entities from Stories
**As the** system,  
**I want to** automatically extract people, years, places, and events from each story,  
**So that** the family knowledge base grows structured and searchable.

**Acceptance Criteria:**
- After each conversation turn, entities are extracted asynchronously (non-blocking to the conversation flow).
- Entity types: person (with relationship to Oma if stated), year, place, event.
- Each entity links back to its source message and session.
- Entities include the decade they relate to (inferred from years or context).
- Duplicate entities (same name + type) are merged, accumulating source references.
- If entity extraction fails (Azure OpenAI error), the conversation continues unaffected; extraction is retried on next opportunity.
- If no entities are found in a message, no error is raised — this is a normal case for small talk or greetings.

### US-13: Detect Decade Gaps
**As the** AI interviewer,  
**I want to** notice when certain decades have few stories,  
**So that** I can gently ask Oma to share more about those periods.

**Acceptance Criteria:**
- The system tracks story coverage by decade (1930s through 2020s).
- When a decade has fewer than 3 entities, it is flagged as "thin."
- The AI naturally works gap-filling questions into the conversation flow (no more than one gap question per 5 conversation turns to avoid feeling like an interrogation).
- Gap questions are warm and specific (e.g., "You haven't told me much about the 1960s — what was daily life like for you then?").
- If all decades are adequately covered, the AI continues with general open-ended prompts.
- The coverage data is available via API for the timeline visualization.

### US-14: Ask "What Do You Know About...?"
**As a** family member,  
**I want to** ask "What do you know about Uncle Hans?" or any topic,  
**So that** I can retrieve compiled knowledge from Oma's stories.

**Acceptance Criteria:**
- A search/ask interface accepts natural language questions.
- The system searches all stored stories and entities for relevant information.
- The AI composes a warm, narrative answer using Oma's own words and details.
- The answer references which conversations the information came from (session date and ID).
- If no information exists, the AI says so honestly and suggests asking Oma about it in the next conversation.
- If the question is empty or only whitespace, the UI shows a validation message: "Bitte stellen Sie eine Frage." (Please ask a question.)
- If the AI service is unavailable, the app shows an error and offers retry.
- Queries are processed within 5 seconds (P95).

### US-15: Resume a Conversation
**As a** family member,  
**I want to** stop and restart conversations at any time,  
**So that** the AI always remembers everything that was already shared.

**Acceptance Criteria:**
- When a conversation ends, a summary is generated and stored.
- When a new conversation starts, all previous stories, entities, and summaries are loaded.
- The AI references specific details from past conversations in its welcome-back greeting.
- No stories or context are ever lost between sessions.

### US-16: View Conversation History
**As a** family member,  
**I want to** browse past conversations and see extracted highlights,  
**So that** I can review what stories have been captured.

**Acceptance Criteria:**
- A session list shows all past conversations with date, duration, and summary.
- If no sessions exist, the page shows an empty state: "Noch keine Gespräche — starten Sie das erste!" (No conversations yet — start the first one!) with a link to the main page.
- Clicking a session shows the full transcript.
- Extracted entities are displayed alongside the transcript as highlights.
- A timeline/decade view shows coverage across Oma's life.
- The session list is sorted by date, most recent first.
- The session list paginates or lazy-loads if more than 20 sessions exist.

## 5. Functional Requirements

### FR-10: Story Conversation API
| Endpoint | Method | Description |
|---|---|---|
| `/api/stories/sessions` | POST | Create a new conversation session. Returns session ID and welcome message. |
| `/api/stories/sessions` | GET | List all conversation sessions with summaries. |
| `/api/stories/sessions/:id` | GET | Get a single session with metadata. Returns 404 if not found. |
| `/api/stories/sessions/:id/messages` | POST | Send a message in a session. Body: `{ message }`. Returns AI response. |
| `/api/stories/sessions/:id/messages` | GET | Get all messages for a session. Returns 404 if session not found. |
| `/api/stories/sessions/:id/end` | POST | End a session (triggers summary generation). Returns 404 if not found, 409 if already ended. |
| `/api/stories/ask` | POST | Ask a knowledge query. Body: `{ question }`. Returns compiled answer. Returns 400 if question is empty. |
| `/api/stories/entities` | GET | Get all extracted entities. Returns empty array if none exist. |
| `/api/stories/entities/search` | GET | Search entities. Query param: `q`. Returns empty array if no matches. Returns 400 if `q` is missing. |
| `/api/stories/coverage` | GET | Get decade coverage and gap analysis. |

All error responses use the shape: `{ "error": "<message>" }`. All endpoints return 500 with `{ "error": "Internal server error" }` for unexpected failures.

### FR-11: Voice Pipeline
- Real-time speech-to-text via browser Web Speech API (MVP) or Azure Speech SDK (production).
- Text-to-speech for AI responses via browser SpeechSynthesis API (MVP) or Azure TTS (production).
- WebSocket endpoint (`/api/voice`) for future Azure VoiceLive integration.
- Voice state management: idle → listening → thinking → speaking → listening.

### FR-12: Data Model
- **Session**: `{ id, startedAt, endedAt, summary, messageCount, status }` — status is `active` or `ended`
- **Message**: `{ id, sessionId, role, content, timestamp }` — role is `user` or `assistant`
- **Entity**: `{ id, name, type, context, relationship, decade, sourceMessageIds[], sourceSessionIds[], createdAt, updatedAt }`
- Entity deduplication: entities with the same `name` (case-insensitive) and `type` are merged; `sourceMessageIds` and `sourceSessionIds` accumulate
- Storage: JSON file store for MVP, Cosmos DB for production.

### FR-13: AI Conversation Engine
- System prompt includes: (a) conversation personality and instructions, (b) all previously extracted entities as structured context, (c) summaries of previous sessions, (d) the current session's full transcript.
- To manage token limits: entities are sent as a compact JSON list; previous session transcripts are replaced by their summaries; only the current session's full transcript is included. If the total context exceeds 80% of the model's context window, the oldest session summaries are trimmed first.
- Conversation starts with a warm, open-ended question if no prior stories exist.
- Returning conversations reference specific past details.
- Entity extraction runs after each user message via a separate Azure OpenAI call (async, non-blocking to conversation flow).
- Gap detection influences follow-up question selection.
- Knowledge queries search all entities and compose narrative answers using a separate system prompt optimized for retrieval.
- All Azure OpenAI calls include retry logic (3 attempts with exponential backoff) and timeout (30 seconds).

### FR-14: Frontend Pages
| Route | Description | Auth Required |
|---|---|---|
| `/` | Main conversation page — voice/text chat with Oma-friendly UI | No |
| `/history` | List of past sessions with summaries | No |
| `/history/:id` | Full transcript view with entity highlights | No |
| `/ask` | Knowledge query page ("What do you know about...?") | No |
| `/timeline` | Decade coverage timeline visualization | No |

## 6. Non-Functional Requirements

- **NFR-10:** End-to-end voice latency (Oma stops speaking → AI starts responding) < 2 seconds (P95).
- **NFR-11:** All transcripts and entities are persisted immediately — no data loss on disconnect. Messages are saved individually as they arrive, not batched.
- **NFR-12:** The app must work on Chrome, Firefox, and Safari (latest versions). Voice features require Chrome or Edge; other browsers fall back to text-only mode.
- **NFR-13:** Elderly-friendly UI: minimum 18px font, high contrast (WCAG 2.1 AA, minimum 4.5:1 contrast ratio for text), large touch targets (minimum 48×48 px).
- **NFR-14:** Voice conversations can last up to 60 minutes without degradation.
- **NFR-15:** The AI responds in whatever language Oma uses (German by default). The UI chrome (buttons, labels, navigation) is in German.
- **NFR-16:** All interactive elements are keyboard-accessible. Focus order follows visual layout. Screen reader users can understand conversation state via ARIA live regions.
- **NFR-17:** The app gracefully degrades when Azure OpenAI is unavailable — users see a clear error message and can retry. No unhandled errors or blank screens.
- **NFR-18:** The JSON file store supports up to 1000 sessions and 100,000 messages for the MVP. Beyond this, Cosmos DB migration is required.

## 7. Out of Scope (MVP)

- Multi-user accounts or authentication (family shares one instance).
- Audio recording storage (only transcripts are stored in MVP).
- Photo or document attachment to stories.
- Export/print of family history book.
- Mobile native app (web-only for MVP).

## 8. Future Considerations

- **Family accounts:** Add authentication so multiple family members can log in and contribute.
- **Azure VoiceLive API:** Replace browser speech APIs with Azure's real-time voice services for higher accuracy.
- **Cosmos DB:** Replace JSON file store with Azure Cosmos DB for scalability.
- **Family History Book:** Generate a printable PDF from all collected stories.
- **Photo integration:** Allow attaching photos to specific stories or entities.
- **Multi-language support:** Detect and support multiple languages within the same conversation.

## 9. Technical Stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Backend:** Express.js (TypeScript)
- **AI:** Azure OpenAI (GPT-4o) for conversation, entity extraction, and knowledge queries
- **Voice (MVP):** Browser Web Speech API (SpeechRecognition + SpeechSynthesis)
- **Voice (Production):** Azure Speech SDK / VoiceLive API
- **Storage (MVP):** JSON file store
- **Storage (Production):** Azure Cosmos DB
- **Deployment:** Azure Container Apps via AZD
