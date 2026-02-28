# Flow Walkthrough — OmasApp User Journeys

## 1. Story Conversation Flow

**FRD:** FRD-Stories (US-10, US-11, US-15), FRD-Voice (US-10, US-11)

### Steps

1. **Land on main page (`/`)**
   - User sees welcome header "💛 Omas Geschichten" and a large "Gespräch starten" button.
   - If past sessions exist, a brief summary of the last conversation is shown.

2. **Start conversation**
   - User clicks "Gespräch starten" or taps the microphone button.
   - Browser requests microphone permission (if voice mode).
   - If denied → text fallback enabled, friendly instructions shown.
   - `POST /api/stories/sessions` creates a new session.
   - AI welcome message appears in the chat area.
   - Voice state transitions to `listening`.

3. **Tell a story (voice)**
   - User speaks freely. Interim transcript shows in grey.
   - After 3-second pause → speech finalized → voice state transitions to `processing` → `thinking`.
   - `POST /api/stories/sessions/:id/messages` sends the text.
   - AI response appears in chat. Voice state → `speaking` (TTS reads response).
   - After TTS completes → voice state → `listening` (auto-resume).

4. **Tell a story (text fallback)**
   - User types in the text input field.
   - Presses Enter or clicks ➤ send button.
   - Same API call and response flow as voice mode.

5. **Entity extraction (background)**
   - After each user message, entities are extracted asynchronously.
   - Users don't see this directly — entities appear in transcript view later.

6. **Gap question (periodic)**
   - Every 5+ turns, if a decade is underrepresented, the AI naturally works in a question: "Sie haben noch nicht viel über die 1970er Jahre erzählt — wie war das Leben damals?"

7. **End conversation**
   - User clicks "⏹ Gespräch beenden".
   - `POST /api/stories/sessions/:id/end` ends the session.
   - AI says farewell. Summary is generated.
   - Voice state → `idle`. Input disabled.

8. **Resume later**
   - On next visit, starting a new session triggers `POST /api/stories/sessions`.
   - AI greeting references past stories and entities from context.

---

## 2. Knowledge Query Flow

**FRD:** FRD-Knowledge (US-14)

### Steps

1. **Navigate to Ask page (`/ask`)**
   - User sees large search input "Was möchten Sie wissen?"
   - Example question chips are shown below.

2. **Enter a question**
   - User types a question or clicks an example chip to populate the input.
   - Clicking "Fragen" or pressing Enter submits.

3. **Validation**
   - If input is empty → inline message: "Bitte stellen Sie eine Frage."
   - If valid → loading spinner appears: "Suche in Omas Geschichten…"

4. **Search and answer**
   - `POST /api/stories/ask` sends the question.
   - Backend searches entities, retrieves source messages, composes AI answer.
   - Answer appears in a warm narrative card.

5. **Review sources**
   - Below the answer, source references show which sessions the info came from.
   - Each source shows: date, excerpt, and "→ Gespräch ansehen" link.
   - Clicking a source navigates to `/history/:id` (transcript page).

6. **No results**
   - If no matching information exists:
   - Message: "Dazu hat Oma leider noch nichts erzählt."
   - Suggestion: "Vielleicht können Sie sie beim nächsten Gespräch danach fragen!"
   - Link to start a new conversation.

7. **Error state**
   - If AI service unavailable: "Die Suche ist gerade nicht möglich. Bitte versuchen Sie es erneut."
   - Retry button shown.

---

## 3. History Browsing Flow

**FRD:** FRD-Stories (US-16)

### Steps

1. **Navigate to History page (`/history`)**
   - Session list shows all past conversations as cards.
   - Each card shows: date ("15. Januar 2025"), summary preview, message count, duration.
   - Sessions sorted by date, newest first.

2. **Empty state**
   - If no sessions exist: "Noch keine Gespräche — starten Sie das erste!"
   - Large button links to conversation page.

3. **Browse sessions**
   - User scrolls through session cards.
   - Can filter by "Alle" or "Letzte 7 Tage".
   - "Mehr laden" button for pagination after 20 sessions.

4. **Open a transcript**
   - User clicks a session card → navigates to `/history/:id`.
   - Transcript page shows session header (date, duration, summary).
   - Full message list with timestamps and role labels (👵 Oma / 🤖 KI-Begleiterin).

5. **View entity highlights**
   - Entity chips appear below user messages where entities were extracted.
   - Color-coded: 👤 Person (blue), 📍 Place (green), 📆 Year (amber), ⭐ Event (purple).
   - Legend at top explains the colors.

6. **Navigate back**
   - "← Zurück zum Verlauf" link returns to history list.

---

## 4. Timeline Flow

**FRD:** FRD-Knowledge (US-13, US-16)

### Steps

1. **Navigate to Timeline page (`/timeline`)**
   - Horizontal decade bars from 1930s to 2020s.
   - Each bar shows entity count and coverage status.
   - Legend explains: green (covered, 3+), amber (thin, 1–2), grey (empty, 0).

2. **Identify gaps**
   - Decades with "thin" or "empty" status have a "wenig erzählt" label.
   - These decades are visually distinct (dashed border for empty, amber border for thin).

3. **Click a decade**
   - Detail panel slides in below the timeline.
   - Shows all entities from that decade in a grid.
   - Each entity card shows: type chip, name, context description.

4. **Empty decade detail**
   - If the decade has no entities: "Noch keine Geschichten aus diesem Jahrzehnt. 💛"
   - Suggestion: "Fragen Sie Oma beim nächsten Gespräch!"

5. **Close detail**
   - "✕" button closes the detail panel.
   - Decade row is de-highlighted.

6. **Take action on gaps**
   - User notes which decades need more stories.
   - Navigates to conversation page to start a session.
   - AI will naturally prompt about gap decades during conversation (FRD-Knowledge §4).
