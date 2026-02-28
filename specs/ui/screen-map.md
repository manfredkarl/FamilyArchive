# Screen Map — OmasApp

## Screens

### 1. Main Conversation Page

| Field | Detail |
|-------|--------|
| **Route** | `/` |
| **Purpose** | Primary story-telling interface — voice/text chat with Oma |
| **FRD Mapping** | FRD-Stories §6.1, FRD-Voice §2, §6; US-10, US-11, US-15 |
| **Key Elements** | Welcome header with 💛, chat message list, text input + send button, microphone toggle, voice state indicator (idle/listening/processing/thinking/speaking/error), "Gespräch starten" CTA, "Gespräch beenden" button, interim transcript preview, error/retry banner |
| **Navigation** | → `/history` (nav link), → `/ask` (nav link), → `/timeline` (nav link) |

### 2. History List Page

| Field | Detail |
|-------|--------|
| **Route** | `/history` |
| **Purpose** | Browse all past conversation sessions |
| **FRD Mapping** | FRD-Stories §6.2; US-16 |
| **Key Elements** | Session card list (date, summary preview, message count, duration), empty state message with link to `/`, "Mehr laden" pagination button |
| **Navigation** | → `/history/:id` (click session card), → `/` (nav link), → `/ask` (nav link), → `/timeline` (nav link) |

### 3. Session Transcript Page

| Field | Detail |
|-------|--------|
| **Route** | `/history/:id` |
| **Purpose** | Full conversation transcript with entity highlights |
| **FRD Mapping** | FRD-Stories §6.3; FRD-Knowledge §6.1; US-16 |
| **Key Elements** | Session summary header (date, duration, summary text), message list with timestamps and role labels, entity highlight chips (person=blue, place=green, year=amber, event=purple), back link to `/history`, not-found state |
| **Navigation** | → `/history` (back link), → `/` (nav link) |

### 4. Knowledge Query Page

| Field | Detail |
|-------|--------|
| **Route** | `/ask` |
| **Purpose** | Ask natural-language questions about Oma's stories |
| **FRD Mapping** | FRD-Knowledge §2.4, §5; US-14 |
| **Key Elements** | Large search input ("Was möchten Sie wissen?"), "Fragen" submit button, example question chips, answer display area, source references (links to session transcripts), loading spinner ("Suche in Omas Geschichten..."), no-results state, error/retry state |
| **Navigation** | → `/history/:id` (source reference links), → `/` (nav link), → `/history` (nav link), → `/timeline` (nav link) |

### 5. Timeline Page

| Field | Detail |
|-------|--------|
| **Route** | `/timeline` |
| **Purpose** | Decade coverage visualization — identify gaps in Oma's stories |
| **FRD Mapping** | FRD-Knowledge §2.3, §4; US-13, US-16 |
| **Key Elements** | Horizontal decade bars (1930s–2020s), entity count per decade, coverage status coloring (covered/thin/empty), "wenig erzählt" gap labels, click-to-filter entity list per decade, story count per decade |
| **Navigation** | → `/` (nav link), → `/history` (nav link), → `/ask` (nav link) |

## Navigation Map

```
         ┌──────────┐
    ┌────│    /     │────┐
    │    │  (Main)  │    │
    │    └────┬─────┘    │
    │         │          │
    ▼         ▼          ▼
┌────────┐ ┌──────┐ ┌────────┐
│/history│ │ /ask │ │/timeline│
└───┬────┘ └──────┘ └────────┘
    │
    ▼
┌──────────┐
│/history/ │
│   :id    │
└──────────┘

All pages share a global nav bar with links to: /, /history, /ask, /timeline
```

## Global Elements (all pages)

| Element | Detail |
|---------|--------|
| Navigation bar | Links to all five top-level routes; current page highlighted |
| App title | "Omas Geschichten 💛" |
| Language | `lang="de"` on HTML root |
| Font size | 18px+ body, 24px+ headings |
| Touch targets | 48×48 px minimum |
