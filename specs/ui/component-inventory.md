# Component Inventory — OmasApp

## Shared / Global Components

### 1. NavBar

| Field | Detail |
|-------|--------|
| **Screens** | All pages |
| **Purpose** | Global navigation between app sections |
| **Props** | `activeRoute: string` — highlights current page link |
| **States** | Default (all links neutral), Active (current page highlighted with amber underline) |
| **Elements** | Brand logo/text ("💛 Omas Geschichten"), nav links (Gespräch, Verlauf, Fragen, Zeitstrahl) |
| **data-testid** | `nav-conversation`, `nav-history`, `nav-ask`, `nav-timeline` |

### 2. Button

| Field | Detail |
|-------|--------|
| **Screens** | All pages |
| **Purpose** | Primary interaction trigger |
| **Props** | `variant: 'primary' | 'secondary' | 'danger' | 'ghost'`, `disabled: boolean`, `label: string`, `icon?: string` |
| **States** | Default, Hover, Focus, Disabled |
| **data-testid** | Contextual: `send-button`, `mic-button`, `end-conversation-button`, `ask-button`, `load-more-button`, `start-first-conversation` |

---

## Conversation Page Components

### 3. ChatArea

| Field | Detail |
|-------|--------|
| **Screens** | Conversation (`/`) |
| **Purpose** | Scrollable container for conversation messages |
| **Props** | `messages: Message[]` |
| **States** | Empty (no messages yet), Populated (messages visible), Auto-scroll (follows new messages) |
| **data-testid** | `chat-area` |

### 4. ChatMessage

| Field | Detail |
|-------|--------|
| **Screens** | Conversation (`/`), Transcript (`/history/:id`) |
| **Purpose** | Individual message bubble |
| **Props** | `role: 'user' | 'assistant'`, `content: string`, `timestamp: string` |
| **States** | User message (amber, right-aligned), Assistant message (linen, left-aligned), Appearing (slide-up animation) |
| **data-testid** | `message-user`, `message-assistant` |

### 5. VoiceStateIndicator

| Field | Detail |
|-------|--------|
| **Screens** | Conversation (`/`) |
| **Purpose** | Shows current voice pipeline state |
| **Props** | `state: 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error'` |
| **States** | Idle (grey dot), Listening (green pulsing dot), Processing (amber dots), Thinking (amber pulsing), Speaking (purple pulsing), Error (red) |
| **data-testid** | `voice-state`, `voice-indicator`, `voice-label` |

### 6. MicrophoneButton

| Field | Detail |
|-------|--------|
| **Screens** | Conversation (`/`) |
| **Purpose** | Toggle microphone on/off |
| **Props** | `active: boolean`, `disabled: boolean` |
| **States** | Inactive (linen background), Active (green background), Disabled (greyed out) |
| **Accessibility** | `aria-pressed`, `aria-label` changes with state |
| **data-testid** | `mic-button` |

### 7. MessageInput

| Field | Detail |
|-------|--------|
| **Screens** | Conversation (`/`) |
| **Purpose** | Text input for typing messages (fallback to voice) |
| **Props** | `disabled: boolean`, `placeholder: string` |
| **States** | Default, Focused (amber border glow), Disabled |
| **data-testid** | `message-input` |

### 8. SendButton

| Field | Detail |
|-------|--------|
| **Screens** | Conversation (`/`) |
| **Purpose** | Submit typed message |
| **Props** | `disabled: boolean` |
| **States** | Default, Hover, Disabled |
| **data-testid** | `send-button` |

### 9. EndConversationButton

| Field | Detail |
|-------|--------|
| **Screens** | Conversation (`/`) |
| **Purpose** | End the current conversation session |
| **Props** | `disabled: boolean`, `visible: boolean` |
| **States** | Hidden (no active session), Visible, Disabled (after ending) |
| **data-testid** | `end-conversation-button` |

---

## History Page Components

### 10. SessionCard

| Field | Detail |
|-------|--------|
| **Screens** | History (`/history`) |
| **Purpose** | Summary card for a past conversation session |
| **Props** | `date: string`, `summary: string`, `messageCount: number`, `duration: string`, `sessionId: string` |
| **States** | Default, Hover (elevated shadow), Focus |
| **data-testid** | `session-card` |

### 11. SessionList

| Field | Detail |
|-------|--------|
| **Screens** | History (`/history`) |
| **Purpose** | Container for session cards |
| **Props** | `sessions: Session[]` |
| **States** | Populated, Empty |
| **data-testid** | `session-list` |

### 12. EmptyState

| Field | Detail |
|-------|--------|
| **Screens** | History (`/history`), Ask (`/ask`) |
| **Purpose** | Shown when no data exists |
| **Props** | `emoji: string`, `message: string`, `actionLabel?: string`, `actionHref?: string` |
| **States** | Single state |
| **data-testid** | `empty-state` |

### 13. LoadMoreButton

| Field | Detail |
|-------|--------|
| **Screens** | History (`/history`) |
| **Purpose** | Pagination — load additional sessions |
| **Props** | `visible: boolean`, `loading: boolean` |
| **States** | Default, Loading, Hidden (no more results) |
| **data-testid** | `load-more-button` |

### 14. FilterToggle

| Field | Detail |
|-------|--------|
| **Screens** | History (`/history`) |
| **Purpose** | Toggle between filter views (All / Recent) |
| **Props** | `options: string[]`, `activeOption: string` |
| **States** | Each option: Active (amber bg), Inactive (linen bg) |
| **data-testid** | `filter-all`, `filter-recent` |

---

## Transcript Page Components

### 15. SessionHeader

| Field | Detail |
|-------|--------|
| **Screens** | Transcript (`/history/:id`) |
| **Purpose** | Session metadata and summary at top of transcript |
| **Props** | `date: string`, `duration: string`, `messageCount: number`, `summary: string` |
| **States** | Single state |
| **data-testid** | `session-header`, `session-summary` |

### 16. TranscriptMessage

| Field | Detail |
|-------|--------|
| **Screens** | Transcript (`/history/:id`) |
| **Purpose** | Message in full transcript with role label and timestamp |
| **Props** | `role: 'user' | 'assistant'`, `content: string`, `timestamp: string`, `entities?: Entity[]` |
| **States** | User turn (amber bg), Assistant turn (linen bg) |
| **data-testid** | `transcript-message` |

### 17. EntityChip

| Field | Detail |
|-------|--------|
| **Screens** | Transcript (`/history/:id`), Timeline (`/timeline`) |
| **Purpose** | Colored pill showing an extracted entity |
| **Props** | `name: string`, `type: 'person' | 'place' | 'year' | 'event'` |
| **States** | Person (blue), Place (green), Year (amber), Event (purple) |
| **data-testid** | `entity-person`, `entity-place`, `entity-year`, `entity-event` |

### 18. EntityChipGroup

| Field | Detail |
|-------|--------|
| **Screens** | Transcript (`/history/:id`) |
| **Purpose** | Container for entity chips below a message |
| **Props** | `entities: Entity[]` |
| **States** | Visible (entities present), Hidden (no entities) |
| **data-testid** | `entity-chips` |

### 19. EntityLegend

| Field | Detail |
|-------|--------|
| **Screens** | Transcript (`/history/:id`) |
| **Purpose** | Color legend explaining entity chip types |
| **Props** | None |
| **States** | Single state |
| **data-testid** | `entity-legend` |

### 20. BackLink

| Field | Detail |
|-------|--------|
| **Screens** | Transcript (`/history/:id`) |
| **Purpose** | Navigation back to history list |
| **Props** | `href: string`, `label: string` |
| **States** | Single state |
| **data-testid** | `back-to-history` |

---

## Ask Page Components

### 21. QuestionInput

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Large text input for knowledge queries |
| **Props** | `placeholder: string`, `value: string` |
| **States** | Default, Focused, Error (validation) |
| **data-testid** | `question-input` |

### 22. AskButton

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Submit knowledge query |
| **Props** | `disabled: boolean` |
| **States** | Default, Hover, Disabled |
| **data-testid** | `ask-button` |

### 23. ExampleChip

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Clickable example question that populates the input |
| **Props** | `question: string` |
| **States** | Default, Hover (honey bg) |
| **data-testid** | `example-chip` |

### 24. AnswerArea

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Display area for the narrative answer |
| **Props** | `answer: string` |
| **States** | Hidden, Visible |
| **data-testid** | `answer-area`, `answer-text` |

### 25. SourceReference

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Link to the session that sourced part of the answer |
| **Props** | `sessionDate: string`, `excerpt: string`, `sessionId: string` |
| **States** | Single state |
| **data-testid** | `source-reference`, `source-link` |

### 26. LoadingSpinner

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Loading indicator during search |
| **Props** | `visible: boolean`, `message: string` |
| **States** | Hidden, Visible (with "Suche in Omas Geschichten…") |
| **data-testid** | `loading-state` |

### 27. NoResultsState

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Shown when no knowledge matches the query |
| **Props** | `visible: boolean` |
| **States** | Hidden, Visible |
| **data-testid** | `no-results-state` |

### 28. ValidationMessage

| Field | Detail |
|-------|--------|
| **Screens** | Ask (`/ask`) |
| **Purpose** | Inline error when submitting empty question |
| **Props** | `visible: boolean`, `message: string` |
| **States** | Hidden, Visible |
| **data-testid** | `validation-message` |

---

## Timeline Page Components

### 29. TimelineLegend

| Field | Detail |
|-------|--------|
| **Screens** | Timeline (`/timeline`) |
| **Purpose** | Color legend for coverage statuses |
| **Props** | None |
| **States** | Single state |
| **data-testid** | `timeline-legend` |

### 30. DecadeRow

| Field | Detail |
|-------|--------|
| **Screens** | Timeline (`/timeline`) |
| **Purpose** | Single decade bar in the timeline |
| **Props** | `decade: string`, `entityCount: number`, `storyCount: number`, `status: 'covered' | 'thin' | 'empty'` |
| **States** | Covered (green bar), Thin (amber bar + gap label), Empty (grey bar + gap label), Active (selected, highlighted border) |
| **data-testid** | `decade-1930s` through `decade-2020s`, `gap-indicator` |

### 31. DecadeDetailPanel

| Field | Detail |
|-------|--------|
| **Screens** | Timeline (`/timeline`) |
| **Purpose** | Expanded view of entities for a selected decade |
| **Props** | `decade: string`, `entities: Entity[]` |
| **States** | Hidden, Visible (with entities), Visible (empty — "no stories yet") |
| **data-testid** | `decade-detail`, `detail-title`, `entity-grid`, `close-detail` |

### 32. EntityCard

| Field | Detail |
|-------|--------|
| **Screens** | Timeline (`/timeline`) |
| **Purpose** | Card showing a single entity with type chip and context |
| **Props** | `name: string`, `type: string`, `context: string` |
| **States** | Single state |
| **data-testid** | `entity-card` |
