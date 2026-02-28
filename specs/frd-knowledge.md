# FRD-KNOWLEDGE: Entity Extraction, Gap Detection & Knowledge Queries

**Covers:** US-12, US-13, US-14
**Depends on:** FRD-Stories (session and message data)

---

## 1. Overview

This FRD specifies the knowledge layer of OmasApp — the system that transforms unstructured conversation transcripts into a structured, searchable family knowledge base. It covers three capabilities: (1) automatic entity extraction from each conversation turn, (2) decade coverage tracking with gap detection to guide the AI interviewer, and (3) a knowledge query system that lets family members ask natural language questions and receive narrative answers compiled from Oma's stories.

---

## 2. API Contracts

### 2.1 GET /api/stories/entities

Returns all extracted entities, sorted by `createdAt` descending.

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | no | all | Filter by entity type: `person`, `year`, `place`, `event` |
| `decade` | string | no | all | Filter by decade: `1930s`, `1940s`, ..., `2020s` |
| `limit` | integer | no | 100 | Max entities to return (1–500) |
| `offset` | integer | no | 0 | Pagination offset |

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | `{ "entities": [...], "total": 85 }` |

**200 Example:**

```json
{
  "entities": [
    {
      "id": "ent_abc123",
      "name": "Onkel Hans",
      "type": "person",
      "context": "Omas Bruder, der in den 1960er Jahren nach München gezogen ist",
      "relationship": "Bruder",
      "decade": "1960s",
      "sourceMessageIds": ["msg_001", "msg_015", "msg_042"],
      "sourceSessionIds": ["sess_abc123", "sess_def456"],
      "createdAt": "2025-01-15T14:35:00.000Z",
      "updatedAt": "2025-01-20T10:12:00.000Z"
    }
  ],
  "total": 1
}
```

If no entities exist, returns `{ "entities": [], "total": 0 }`.

---

### 2.2 GET /api/stories/entities/search

Searches entities by name or context using case-insensitive substring matching.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | yes | Search query (min 1 character after trimming) |

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Results found | `{ "entities": [...], "total": 5 }` |
| 200 | No results | `{ "entities": [], "total": 0 }` |
| 400 | Missing or empty `q` | `{ "error": "Search query is required" }` |

**Search Logic:**
1. Trim the query string.
2. Search `name` and `context` fields for case-insensitive substring match.
3. Sort results by relevance: exact name match first, then name contains, then context contains.
4. Return up to 50 results.

---

### 2.3 GET /api/stories/coverage

Returns decade coverage analysis — the number of entities per decade and gap detection results.

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Success | `{ "decades": [...], "gaps": [...] }` |

**200 Example:**

```json
{
  "decades": [
    { "decade": "1930s", "entityCount": 1, "status": "thin" },
    { "decade": "1940s", "entityCount": 5, "status": "covered" },
    { "decade": "1950s", "entityCount": 12, "status": "covered" },
    { "decade": "1960s", "entityCount": 2, "status": "thin" },
    { "decade": "1970s", "entityCount": 0, "status": "empty" },
    { "decade": "1980s", "entityCount": 8, "status": "covered" },
    { "decade": "1990s", "entityCount": 3, "status": "covered" },
    { "decade": "2000s", "entityCount": 1, "status": "thin" },
    { "decade": "2010s", "entityCount": 0, "status": "empty" },
    { "decade": "2020s", "entityCount": 0, "status": "empty" }
  ],
  "gaps": ["1930s", "1960s", "1970s", "2000s", "2010s", "2020s"]
}
```

**Status Definitions:**

| Status | Condition | Meaning |
|--------|-----------|---------|
| `empty` | 0 entities | No stories from this decade |
| `thin` | 1–2 entities | Under-represented; candidate for gap-filling prompts |
| `covered` | 3+ entities | Adequately represented |

---

### 2.4 POST /api/stories/ask

Accepts a natural language question and returns a narrative answer compiled from Oma's stories.

**Request Body:**

```json
{
  "question": "Was weißt du über Onkel Hans?"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `question` | string | yes | Non-empty after trimming, max 500 characters |

**Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Answer generated | `{ "answer": "...", "sources": [...] }` |
| 200 | No information found | `{ "answer": "...", "sources": [] }` |
| 400 | Empty question | `{ "error": "Question is required" }` |
| 400 | Question too long | `{ "error": "Question must not exceed 500 characters" }` |
| 503 | Azure OpenAI unavailable | `{ "error": "AI service is currently unavailable. Please try again." }` |
| 500 | Unexpected error | `{ "error": "Internal server error" }` |

**200 Example (information found):**

```json
{
  "answer": "Onkel Hans war Omas Bruder. Er ist in den 1960er Jahren nach München gezogen, wo er als Schreiner gearbeitet hat. Oma hat erzählt, dass er jeden Sommer nach Heidelberg zurückkam und immer selbstgemachte Marmelade mitbrachte.",
  "sources": [
    {
      "sessionId": "sess_abc123",
      "sessionDate": "2025-01-15T14:30:00.000Z",
      "messageId": "msg_001",
      "excerpt": "Mein Bruder Hans ist in den Sechzigern nach München..."
    },
    {
      "sessionId": "sess_def456",
      "sessionDate": "2025-01-20T10:00:00.000Z",
      "messageId": "msg_042",
      "excerpt": "Der Hans hat immer seine Marmelade mitgebracht..."
    }
  ]
}
```

**200 Example (no information):**

```json
{
  "answer": "Dazu hat Oma leider noch nichts erzählt. Vielleicht können Sie sie beim nächsten Gespräch danach fragen!",
  "sources": []
}
```

---

## 3. Entity Extraction Pipeline

### 3.1 Trigger

Entity extraction is triggered asynchronously after each user message is processed by the conversation API (see FRD-Stories §2.4). It does not block the conversation response.

### 3.2 Extraction Prompt

A separate Azure OpenAI call with a specialized system prompt:

**System Prompt:**

```
You are an entity extraction system for a family story preservation app. 
Extract entities from the following message spoken by an elderly person sharing family memories.

For each entity, provide:
- name: The entity name (person's name, place name, year, or event description)
- type: One of "person", "year", "place", "event"
- context: A brief description of how this entity relates to the story (1-2 sentences)
- relationship: For persons only — their relationship to the speaker (e.g., "Bruder", "Tochter", "Nachbar"). Null for non-person entities.
- decade: The decade this entity relates to (e.g., "1960s"). Infer from explicit years or contextual clues. Use null if no decade can be inferred.

Return a JSON array. If no entities are found, return an empty array [].
Do not invent entities. Only extract what is explicitly stated or clearly implied.
```

**User Message:** The user's message content.

### 3.3 Response Parsing

**Expected Response Format:**

```json
[
  {
    "name": "Onkel Hans",
    "type": "person",
    "context": "Omas Bruder, der nach München gezogen ist",
    "relationship": "Bruder",
    "decade": "1960s"
  },
  {
    "name": "München",
    "type": "place",
    "context": "Stadt, in die Onkel Hans in den 1960ern gezogen ist",
    "relationship": null,
    "decade": "1960s"
  }
]
```

**Parsing Rules:**
1. Parse the response as JSON. If parsing fails, log the error and discard (do not retry for parse errors — the response is malformed).
2. Validate each entity has at least `name` and `type`.
3. Validate `type` is one of: `person`, `year`, `place`, `event`. Discard entities with invalid types.
4. If `decade` is present, validate it matches the pattern `/^\d{4}s$/` (e.g., "1960s"). Discard invalid decade values (set to `null`).

### 3.4 Entity Deduplication

Before storing, check for existing entities with the same `name` (case-insensitive) and `type`:

| Condition | Action |
|-----------|--------|
| No existing entity | Create new entity with fresh ID |
| Existing entity found | Merge: append `sourceMessageId` and `sourceSessionId` to existing arrays. Update `context` if the new context is longer. Update `updatedAt`. |

### 3.5 Storage

Entities stored in `data/entities.json` as an array. Same atomic write pattern as sessions (write to temp file, then rename).

### 3.6 Error Handling

| Failure Mode | Action |
|-------------|--------|
| Azure OpenAI timeout (30s) | Log warning. Do not retry immediately. Extraction will happen on next message. |
| Azure OpenAI rate limit (429) | Log warning. Back off. Do not block conversation. |
| Azure OpenAI returns non-JSON | Log error with the raw response. Discard. |
| Azure OpenAI returns empty array | Normal case (e.g., greeting messages). No error. |
| File write fails | Log error. Entities are lost for this message but conversation continues. |

---

## 4. Gap Detection Algorithm

### 4.1 Decade Range

The system tracks decades from 1930s through 2020s (10 decades). This range is configurable but hardcoded for MVP.

### 4.2 Coverage Calculation

```
For each decade in [1930s, 1940s, ..., 2020s]:
  count = number of entities where entity.decade == decade
  if count == 0: status = "empty"
  if count >= 1 AND count <= 2: status = "thin"
  if count >= 3: status = "covered"
```

### 4.3 Gap Identification

A "gap" is any decade with status `empty` or `thin`. The gaps list is sorted chronologically.

### 4.4 Integration with Conversation Engine

The gap analysis is provided to the conversation system prompt (see FRD-Stories §5.1) as follows:

```
The following decades have few or no stories: 1930s (1 entity), 1970s (0 entities).
When appropriate, gently ask about these periods. Do not ask about gaps more than once every 5 conversation turns. Frame questions warmly, e.g., "Sie haben noch nicht viel über die 1970er Jahre erzählt — wie war das Leben damals für Sie?"
```

### 4.5 Gap Question Rules

| Rule | Detail |
|------|--------|
| Frequency limit | At most one gap-related question per 5 conversation turns |
| Priority | Prefer "empty" decades over "thin" decades |
| Chronological preference | Ask about earlier decades first (more likely to be at risk of being lost) |
| Natural integration | Gap questions must feel natural, not interrogative. They are suggestions in the system prompt, not forced. |
| All covered | If no gaps exist, the system prompt omits the gap section entirely |

---

## 5. Knowledge Query System

### 5.1 Query Processing Pipeline

When a family member asks a question via `POST /api/stories/ask`:

1. **Validate** the question (non-empty, ≤ 500 characters).
2. **Search entities** for matches to the question (case-insensitive substring search on `name` and `context`).
3. **Retrieve source messages** for matching entities — load the full message content from the relevant session files.
4. **Compose the AI prompt** with the question, matching entities, and source message excerpts.
5. **Call Azure OpenAI** to generate a narrative answer.
6. **Return** the answer and source references.

### 5.2 Knowledge Query Prompt

**System Prompt:**

```
You are answering a family member's question about their grandmother's ("Oma's") life stories. 
Use ONLY the information provided below from Oma's own conversations. Do not invent or assume facts.

If the provided information answers the question, compose a warm, narrative answer in German that weaves together Oma's own words and details. Reference specific stories naturally.

If the provided information does NOT contain relevant details, respond: "Dazu hat Oma leider noch nichts erzählt. Vielleicht können Sie sie beim nächsten Gespräch danach fragen!"

ENTITIES:
{matched entities as JSON}

SOURCE MESSAGES:
{relevant message excerpts}
```

**User Message:** The family member's question.

### 5.3 Source Reference Construction

For each entity that contributed to the answer, include a source reference:

```typescript
interface SourceReference {
  sessionId: string;
  sessionDate: string;   // ISO 8601
  messageId: string;
  excerpt: string;       // First 200 characters of the source message
}
```

Deduplicate source references by `messageId`.

### 5.4 Token Budget

- System prompt + entities + source messages: up to 30k tokens.
- If source material exceeds this, prioritize entities with the highest number of source references (most mentioned = most relevant).
- Response: up to 1k tokens.

---

## 6. Data Model

### 6.1 Entity

```typescript
interface Entity {
  id: string;                 // Format: "ent_" + nanoid(12)
  name: string;               // Entity name (e.g., "Onkel Hans", "München", "1965")
  type: 'person' | 'year' | 'place' | 'event';
  context: string;            // Brief description of how the entity relates to Oma's stories
  relationship: string | null; // For persons: relationship to Oma. Null for non-persons.
  decade: string | null;      // e.g., "1960s". Null if cannot be inferred.
  sourceMessageIds: string[]; // All messages where this entity was mentioned
  sourceSessionIds: string[]; // All sessions where this entity was mentioned
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}
```

### 6.2 Coverage

```typescript
interface DecadeCoverage {
  decade: string;             // e.g., "1930s"
  entityCount: number;
  status: 'empty' | 'thin' | 'covered';
}
```

Coverage is computed on-the-fly from the entity store — not stored separately.

### 6.3 Storage

- Entities stored in `data/entities.json`.
- No separate coverage file — computed from entity data.
- All writes use atomic file operations (write temp, rename).

---

## 7. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| No entities extracted from a message | Normal case (greetings, filler). No error. Empty array stored for audit but no entities created. |
| Entity name contains only whitespace | Discard the entity during validation. |
| Entity with `type` not in allowed list | Discard the entity. Log warning. |
| Duplicate entity (same name + type, different context) | Merge: keep the longer context, accumulate source references. |
| Two entities with same name but different types | Treated as separate entities (e.g., "Heidelberg" as place and "Heidelberg" as event). |
| Entity with no decade | Stored with `decade: null`. Does not count toward any decade coverage. |
| All decades covered (3+ entities each) | Gap section omitted from conversation prompt. Timeline shows all green. |
| No entities exist at all | Coverage returns all decades as `empty`. All decades are gaps. Timeline shows all muted. |
| Knowledge query with no matching entities | Return the "no information" response with empty sources array. |
| Knowledge query matches entities but source messages are missing | Log warning. Include entities without excerpts. The AI answer may be less detailed. |
| Very broad query (e.g., "Tell me everything") | Return all entities (up to token budget). AI composes a general summary. |
| Query in English when stories are in German | Azure OpenAI handles cross-language understanding. Answer is in German (matching Oma's stories). |
| Entity extraction returns > 20 entities from one message | Accept all valid entities. This is rare but possible for dense storytelling. |
| Conflicting information across sessions | Both versions are stored as separate source references. AI prompt instructs: present both versions and note the difference. |
| Entity search query is a single character | Allowed (after trimming). May return many results — limited to 50. |
| Entity search query matches nothing | Returns `{ "entities": [], "total": 0 }`. |
| Azure OpenAI returns entities not in the message | Discarded by design — the prompt says "only extract what is explicitly stated." If it happens, the entity is still stored (we can't verify without NLP). Future: add confidence scoring. |

---

## 8. Error Catalog

| Endpoint | Status | Error Message |
|----------|--------|---------------|
| GET /api/stories/entities/search | 400 | "Search query is required" |
| POST /api/stories/ask | 400 | "Question is required" |
| POST /api/stories/ask | 400 | "Question must not exceed 500 characters" |
| POST /api/stories/ask | 503 | "AI service is currently unavailable. Please try again." |
| Any endpoint | 500 | "Internal server error" |

Internal (non-API) errors for entity extraction are logged but never surface to the user.

---

## 9. Traceability

| User Story | PRD Reference | Covered In |
|------------|---------------|------------|
| US-12 | Extract Entities from Stories | §3 (extraction pipeline), §6 (entity model), §7 (edge cases) |
| US-13 | Detect Decade Gaps | §4 (gap detection algorithm), §2.3 (coverage API), §7 (edge cases) |
| US-14 | Ask "What Do You Know About...?" | §2.4 (ask API), §5 (query pipeline), §7 (edge cases) |
