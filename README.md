# OmasApp — Family Story Preservation 💛

A conversational AI app that helps families preserve their stories through warm voice conversations with Oma (grandma). Built with Azure VoiceLive API for real-time voice-to-voice interaction.

## What it does

- 🎙️ **Voice Conversations** — Oma talks, the AI listens and responds with a warm German voice (Azure VoiceLive)
- 🧠 **Entity Extraction** — Automatically extracts people, places, years, and events from stories
- 📊 **Decade Timeline** — Tracks which decades have stories, highlights gaps
- ❓ **Knowledge Queries** — Family members ask "Was weißt du über Onkel Hans?" and get narrative answers
- 📚 **Conversation History** — Browse past sessions with full transcripts and entity highlights
- 💾 **Session Persistence** — AI remembers everything, picks up where you left off

## Architecture

```
Browser (mic/speaker) ←→ Express API (WebSocket relay) ←→ Azure VoiceLive API
                      ←→ Express API (REST) ←→ Azure OpenAI (text chat, entities, knowledge queries)
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | Express.js 5, TypeScript |
| Voice | Azure VoiceLive API (gpt-4o + de-DE-ConradNeural) |
| AI | Azure OpenAI (gpt-4o) via DefaultAzureCredential |
| Storage | In-memory (MVP), Cosmos DB ready |
| Auth | Azure Managed Identity (no API keys) |

## Prerequisites

- Node.js 20+
- Azure CLI (`az login`)
- Azure AI Services resource with VoiceLive enabled (Sweden Central recommended)
- Azure OpenAI resource with gpt-4o deployed

## Quick Start

```bash
# Clone
git clone https://github.com/manfredkarl/FamilyArchive.git
cd FamilyArchive

# Install
cd src/api && npm install && cd ../web && npm install && cd ../..

# Configure (set your Azure endpoints)
export AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
export AZURE_OPENAI_DEPLOYMENT=gpt-4o
export AZURE_VOICELIVE_ENDPOINT=https://your-ai-services.cognitiveservices.azure.com/
export AZURE_VOICELIVE_MODEL=gpt-4o

# Start API (port 5001)
cd src/api && npx tsx src/index.ts

# Start Web (port 3000) — in another terminal
cd src/web && NEXT_PUBLIC_API_URL=http://localhost:5001 npx next dev

# Open http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint for text chat |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | Model deployment name (e.g. `gpt-4o`) |
| `AZURE_VOICELIVE_ENDPOINT` | For voice | Azure AI Services endpoint with VoiceLive |
| `AZURE_VOICELIVE_MODEL` | For voice | VoiceLive model (default: `gpt-4o`) |
| `NEXT_PUBLIC_API_URL` | For dev | API URL for frontend (default: `http://localhost:5001`) |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main conversation page — voice + text |
| `/history` | Past conversation sessions |
| `/history/:id` | Full transcript with entity highlights |
| `/ask` | Knowledge queries ("Was weißt du über...?") |
| `/timeline` | Decade coverage visualization |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/stories/sessions` | Start new conversation |
| GET | `/api/stories/sessions` | List all sessions |
| POST | `/api/stories/sessions/:id/messages` | Send message |
| POST | `/api/stories/sessions/:id/end` | End conversation |
| POST | `/api/stories/ask` | Knowledge query |
| GET | `/api/stories/entities` | List extracted entities |
| GET | `/api/stories/coverage` | Decade coverage |
| WS | `/api/voice` | VoiceLive WebSocket relay |

## Tests

```bash
cd src/api && npm test    # unit tests
```

## Built with spec2cloud

This project was built following the [spec2cloud](https://github.com/EmeaAppGbb/spec2cloud-shell-nextjs-typescript) methodology — from PRD → FRDs → UI prototypes → incremental delivery.
