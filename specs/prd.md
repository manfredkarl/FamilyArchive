# Product Requirements Document — OmasApp (Family Story Preservation)

## 1. Overview

OmasApp is a conversational AI application that helps families preserve their stories and memories through natural voice conversations with grandma ("Oma"). The app uses Azure's voice and AI services to conduct warm, patient interviews — capturing stories, extracting key details (people, places, dates, events), and building a searchable family knowledge base over time. Family members can later ask "What do you know about X?" and receive answers drawn from Oma's own words.

## 2. Goals

- Provide a frictionless, voice-first interface that feels like a natural conversation — not technology.
- Capture and permanently store every story Oma shares, with full transcripts.
- Automatically extract entities (people, years, places, events) and organize them by decade.
- Detect gaps in the family timeline and gently prompt Oma to share more about under-represented periods.
- Allow anyone in the family to ask questions and retrieve knowledge from the collected stories.
- Resume conversations seamlessly — always remembering what was already shared.

## 3. User Stories

### US-10: Start a Voice Conversation
**As a** family member,  
**I want to** start a voice conversation with the story-preservation AI,  
**So that** Oma can simply talk and share her memories hands-free.

**Acceptance Criteria:**
- The main page shows a large, prominent "Gespräch starten" (Start Conversation) button.
- Clicking the button requests microphone access and begins listening.
- The AI greets Oma warmly and asks an open-ended question to start.
- If this is a returning session, the AI references previous stories and continues from where they left off.
- Visual indicators show the current state: listening, thinking, or speaking.

### US-11: Tell a Story
**As** Oma,  
**I want to** talk freely about my memories while the AI listens patiently,  
**So that** my stories are captured exactly as I tell them.

**Acceptance Criteria:**
- The AI listens continuously without interrupting.
- After Oma pauses, the AI acknowledges what was said and asks a gentle follow-up question.
- The full transcript is saved after each exchange.
- Oma can speak for as long as she wants — there is no time limit per turn.
- The conversation can also happen via text input as a fallback.

### US-12: Extract Entities from Stories
**As the** system,  
**I want to** automatically extract people, years, places, and events from each story,  
**So that** the family knowledge base grows structured and searchable.

**Acceptance Criteria:**
- After each conversation turn, entities are extracted and stored.
- Entity types: person (with relationship if stated), year, place, event.
- Each entity links back to its source message and session.
- Entities include the decade they relate to (inferred from years or context).

### US-13: Detect Decade Gaps
**As the** AI interviewer,  
**I want to** notice when certain decades have few stories,  
**So that** I can gently ask Oma to share more about those periods.

**Acceptance Criteria:**
- The system tracks story coverage by decade (1930s through 2020s).
- When a decade has fewer than 3 entities, it is flagged as "thin."
- The AI naturally works gap-filling questions into the conversation flow.
- Gap questions are warm and specific (e.g., "You haven't told me much about the 1960s — what was daily life like for you then?").

### US-14: Ask "What Do You Know About...?"
**As a** family member,  
**I want to** ask "What do you know about Uncle Hans?" or any topic,  
**So that** I can retrieve compiled knowledge from Oma's stories.

**Acceptance Criteria:**
- A search/ask interface accepts natural language questions.
- The system searches all stored stories and entities for relevant information.
- The AI composes a warm, narrative answer using Oma's own words and details.
- The answer references which conversations the information came from.
- If no information exists, the AI says so honestly and suggests asking Oma about it.

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
- Clicking a session shows the full transcript.
- Extracted entities are displayed alongside the transcript as highlights.
- A timeline/decade view shows coverage across Oma's life.

## 4. Functional Requirements

### FR-10: Story Conversation API
| Endpoint | Method | Description |
|---|---|---|
| `/api/stories/sessions` | POST | Create a new conversation session. Returns session ID and welcome message. |
| `/api/stories/sessions` | GET | List all conversation sessions with summaries. |
| `/api/stories/sessions/:id/messages` | POST | Send a message in a session. Body: `{ message }`. Returns AI response. |
| `/api/stories/sessions/:id/messages` | GET | Get all messages for a session. |
| `/api/stories/sessions/:id/end` | POST | End a session (triggers summary generation). |
| `/api/stories/ask` | POST | Ask a knowledge query. Body: `{ question }`. Returns compiled answer. |
| `/api/stories/entities` | GET | Get all extracted entities. |
| `/api/stories/entities/search` | GET | Search entities. Query param: `q`. |
| `/api/stories/coverage` | GET | Get decade coverage and gap analysis. |

### FR-11: Voice Pipeline
- Real-time speech-to-text via browser Web Speech API (MVP) or Azure Speech SDK (production).
- Text-to-speech for AI responses via browser SpeechSynthesis API (MVP) or Azure TTS (production).
- WebSocket endpoint (`/api/voice`) for future Azure VoiceLive integration.
- Voice state management: idle → listening → thinking → speaking → listening.

### FR-12: Data Model
- **Session**: `{ id, startedAt, endedAt, summary, messageCount }`
- **Message**: `{ id, sessionId, role, content, timestamp }`
- **Entity**: `{ id, name, type, context, relationship, decade, sourceMessageId, sourceSessionId, createdAt }`
- Storage: JSON file store for MVP, Cosmos DB for production.

### FR-13: AI Conversation Engine
- System prompt includes all previously collected entities and stories for full context.
- Conversation starts with a warm, open-ended question if no prior stories exist.
- Returning conversations reference specific past details.
- Entity extraction runs after each user message (async, non-blocking).
- Gap detection influences follow-up question selection.
- Knowledge queries search all entities and compose narrative answers.

### FR-14: Frontend Pages
| Route | Description | Auth Required |
|---|---|---|
| `/` | Main conversation page — voice/text chat with Oma-friendly UI | No |
| `/history` | List of past sessions with summaries | No |
| `/history/:id` | Full transcript view with entity highlights | No |
| `/ask` | Knowledge query page ("What do you know about...?") | No |
| `/timeline` | Decade coverage timeline visualization | No |

## 5. Non-Functional Requirements

- **NFR-10:** End-to-end voice latency (Oma stops speaking → AI starts responding) < 2 seconds.
- **NFR-11:** All transcripts and entities are persisted immediately — no data loss on disconnect.
- **NFR-12:** The app must work on Chrome, Firefox, and Safari (latest versions).
- **NFR-13:** Elderly-friendly UI: minimum 18px font, high contrast (WCAG 2.1 AA), large touch targets.
- **NFR-14:** Voice conversations can last up to 60 minutes without degradation.
- **NFR-15:** The AI responds in whatever language Oma uses (German by default).

## 6. Out of Scope (MVP)

- Multi-user accounts or authentication (family shares one instance).
- Audio recording storage (only transcripts are stored in MVP).
- Photo or document attachment to stories.
- Export/print of family history book.
- Mobile native app (web-only for MVP).

## 7. Future Considerations

- **Family accounts:** Add authentication so multiple family members can log in and contribute.
- **Azure VoiceLive API:** Replace browser speech APIs with Azure's real-time voice services for higher accuracy.
- **Cosmos DB:** Replace JSON file store with Azure Cosmos DB for scalability.
- **Family History Book:** Generate a printable PDF from all collected stories.
- **Photo integration:** Allow attaching photos to specific stories or entities.
- **Multi-language support:** Detect and support multiple languages within the same conversation.

## 8. Technical Stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Backend:** Express.js (TypeScript)
- **AI:** Azure OpenAI (GPT-4o) for conversation, entity extraction, and knowledge queries
- **Voice (MVP):** Browser Web Speech API (SpeechRecognition + SpeechSynthesis)
- **Voice (Production):** Azure Speech SDK / VoiceLive API
- **Storage (MVP):** JSON file store
- **Storage (Production):** Azure Cosmos DB
- **Deployment:** Azure Container Apps via AZD
