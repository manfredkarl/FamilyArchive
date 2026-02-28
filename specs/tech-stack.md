# Tech Stack — OmasApp

> **Phase 1d artifact.** Every technology decision is resolved here. Implementation agents consult this file first — there must be ZERO open questions.

---

## 1. Frontend Framework — Next.js 16 (App Router)

| Field | Value |
|-------|-------|
| **Package** | `next` |
| **Version** | `16.1.6` (pinned in `src/web/package.json`) |
| **React** | `19.2.3` |
| **Purpose** | Server-side rendered frontend with App Router, file-based routing, React Server Components |
| **Why chosen** | Already in shell; App Router enables streaming, server components, and layout nesting; React 19 supports concurrent features |

### Wiring

```
src/web/
├── src/app/           # App Router — pages, layouts, route handlers
│   ├── layout.tsx     # Root layout (lang="de", font, NavBar)
│   ├── page.tsx       # Main conversation page (/)
│   ├── history/       # /history and /history/[id]
│   ├── ask/           # /ask — knowledge query page
│   └── timeline/      # /timeline — decade coverage
├── next.config.ts     # Next.js config
├── Dockerfile         # Standalone output for container
└── package.json
```

**Config requirements:**
- `next.config.ts`: set `output: 'standalone'` for Docker builds
- Root layout: `<html lang="de">` (German UI chrome)
- `NEXT_PUBLIC_API_URL` env var points to API base URL (default: `http://localhost:5001`)

### Key Patterns

- Use App Router file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Client components (`'use client'`) only for interactive elements (voice controls, chat input)
- Server components for data fetching (history list, session detail)
- Use `fetch()` with the API URL for server-side data loading
- Use React hooks (`useState`, `useEffect`, `useRef`) in client components for voice/chat state

### Anti-Patterns

- ❌ Do NOT use `pages/` directory (Pages Router) — App Router only
- ❌ Do NOT use `getServerSideProps` or `getStaticProps` — use async server components or `fetch()` in server components
- ❌ Do NOT import server-only code in client components
- ❌ Do NOT use API route handlers (`route.ts`) for proxying — call Express API directly from client

### Docs

- [Next.js 16 Docs](https://nextjs.org/docs)
- [App Router](https://nextjs.org/docs/app)

---

## 2. Backend Framework — Express.js 5

| Field | Value |
|-------|-------|
| **Package** | `express` |
| **Version** | `^5.1.0` (in `src/api/package.json`) |
| **Runtime** | Node.js 22+ (LTS) |
| **Language** | TypeScript 5.8+ |
| **Purpose** | REST API for story sessions, messages, entities, knowledge queries |
| **Why chosen** | Already in shell; Express 5 has native async error handling; minimal overhead |

### Wiring

```
src/api/
├── src/
│   ├── index.ts          # Entry point — Express app, middleware, routes
│   ├── routes/           # Route modules (stories.ts, health.ts)
│   ├── services/         # Business logic (conversation.ts, entities.ts, ai.ts)
│   ├── store/            # JSON file store (sessions.ts, messages.ts, entities.ts)
│   └── prompts/          # System prompt templates
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── integration/      # Supertest integration tests
├── Dockerfile
└── package.json
```

**Env vars:**
- `PORT` — Listen port (default: `8080` in container, `5001` in dev)
- `DATA_DIR` — Data directory (default: `./data`)
- `NODE_ENV` — `development` | `production`
- `CORS_ORIGIN` — Allowed CORS origin (default: `http://localhost:3000`)

### Key Patterns

- Express 5 async handlers: `router.get('/path', async (req, res) => { ... })` — errors auto-propagate
- Central error handler middleware at the end of the middleware chain
- All responses follow shape: `{ "data": ... }` for success, `{ "error": "message" }` for errors
- Use `pino-http` middleware for request logging
- Use `helmet` for security headers
- Use `cors` with explicit origin

### Anti-Patterns

- ❌ Do NOT use callback-style error handling (`next(err)`) — Express 5 catches async rejections
- ❌ Do NOT use `body-parser` — Express 5 has built-in `express.json()`
- ❌ Do NOT store state in memory (use JSON file store) — must survive restarts
- ❌ Do NOT block the event loop — all file I/O via async `fs.readFile`/`fs.writeFile`

### Docs

- [Express.js 5](https://expressjs.com/)

---

## 3. AI Service — Azure OpenAI

| Field | Value |
|-------|-------|
| **Service** | Azure OpenAI Service |
| **Model (conversation)** | `gpt-4o` (128k context window) |
| **Model (extraction)** | `gpt-4o-mini` (for entity extraction — lower cost, sufficient quality) |
| **API version** | `2024-12-01-preview` |
| **Auth (MVP)** | API key via env var |
| **Auth (production)** | Managed Identity (Azure AD / Entra ID) |
| **SDK** | Direct REST calls via `fetch()` — no SDK dependency for MVP |
| **Why chosen** | Hosted in Azure (same cloud as deployment); GPT-4o handles German well; 128k context supports long conversations |

### Wiring

**Env vars (required for AI features):**

| Var | Example | Description |
|-----|---------|-------------|
| `AZURE_OPENAI_ENDPOINT` | `https://my-oai.openai.azure.com` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | `abc123...` | API key (MVP auth) |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o` | Deployment name for conversation model |
| `AZURE_OPENAI_DEPLOYMENT_MINI` | `gpt-4o-mini` | Deployment name for extraction model (falls back to `AZURE_OPENAI_DEPLOYMENT` if not set) |

**REST call pattern:**

```typescript
const url = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`;

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'api-key': process.env.AZURE_OPENAI_API_KEY!,
  },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
    max_tokens: 4096,
    temperature: 0.7,
  }),
  signal: AbortSignal.timeout(30_000), // 30s timeout
});
```

**Retry logic:**

```typescript
async function callAzureOpenAI(params, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '1');
        await sleep(retryAfter * 1000);
        continue;
      }
      if (!response.ok) throw new Error(`Azure OpenAI error: ${response.status}`);
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(Math.pow(2, attempt) * 1000); // exponential backoff
    }
  }
}
```

**Fallback when not configured (local dev without Azure):**

```typescript
function isAIConfigured(): boolean {
  return !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY);
}

// Echo fallback for local dev
if (!isAIConfigured()) {
  return { content: `Echo: ${userMessage}` };
}
```

### Key Patterns

- Separate system prompts for: conversation, entity extraction, summary generation, knowledge queries
- Token budget management: personality (500) + entities (10k) + summaries (20k) + transcript (80k) + response (4k)
- Entity extraction is fire-and-forget (async, non-blocking to conversation)
- All Azure OpenAI calls: 3 retries, exponential backoff, 30s timeout
- Response format for extraction: request `response_format: { type: "json_object" }`

### Anti-Patterns

- ❌ Do NOT install `@azure/openai` SDK — use direct REST for MVP (fewer dependencies, simpler)
- ❌ Do NOT send audio to Azure OpenAI — MVP uses browser STT, sends text only
- ❌ Do NOT include full transcripts from all past sessions — use summaries to stay within token budget
- ❌ Do NOT hardcode model names — use env vars for deployment names
- ❌ Do NOT block conversation response waiting for entity extraction

### Docs

- [Azure OpenAI REST API](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference)
- [Chat Completions API](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/chatgpt)

---

## 4. Voice (MVP) — Browser Web Speech API

| Field | Value |
|-------|-------|
| **STT API** | `window.SpeechRecognition` / `webkitSpeechRecognition` |
| **TTS API** | `window.speechSynthesis` / `SpeechSynthesisUtterance` |
| **Dependencies** | None — browser-native |
| **Purpose** | Voice-first conversation interface for Oma |
| **Why chosen** | Zero server-side cost; no additional infrastructure; sufficient for MVP |

### Wiring

All voice code lives in the frontend (`src/web/`):

```
src/web/src/app/
├── hooks/
│   ├── useSpeechRecognition.ts   # STT hook wrapping Web Speech API
│   └── useSpeechSynthesis.ts     # TTS hook wrapping SpeechSynthesis
├── components/
│   ├── VoiceControls.tsx         # Mic toggle, state indicator, controls
│   └── VoiceStateIndicator.tsx   # Visual state (idle/listening/thinking/speaking)
└── lib/
    └── voiceState.ts             # Voice state machine (client-only)
```

**STT config:**

```typescript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'de-DE';
recognition.maxAlternatives = 1;
```

**TTS config:**

```typescript
const utterance = new SpeechSynthesisUtterance(text);
utterance.lang = 'de-DE';
utterance.rate = 0.9;     // Slightly slower for elderly listeners
utterance.pitch = 1.0;
// Select best German voice (prefer localService: true)
```

**Browser compatibility:**

| Browser | STT | TTS | Fallback |
|---------|-----|-----|----------|
| Chrome 33+ | ✅ Full (`webkitSpeechRecognition`) | ✅ Full | — |
| Edge 79+ | ✅ Full | ✅ Full | — |
| Firefox | ❌ Not supported | ✅ Full | Text-only mode |
| Safari 14.1+ | ⚠️ No `continuous` mode | ✅ Full | Auto-restart per utterance |

**Feature detection:**

```typescript
const isSpeechRecognitionSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
```

### Key Patterns

- Voice state machine: `idle → listening → processing → thinking → speaking → listening`
- Auto-restart STT on `onend` event (browsers stop recognition after silence)
- Short pause (3s): finalize and send to API
- Extended silence (30s): gentle prompt via TTS
- Very long silence (5min): auto-end session
- Chunk long TTS (>500 chars) on sentence boundaries
- Always show text input as fallback

### Anti-Patterns

- ❌ Do NOT assume SpeechRecognition exists — always feature-detect
- ❌ Do NOT store voice state server-side — it's client-only, lost on reload
- ❌ Do NOT use `continuous: true` on Safari — use non-continuous with auto-restart
- ❌ Do NOT call `speechSynthesis.speak()` without user gesture on iOS/Safari

### Docs

- [Web Speech API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [SpeechRecognition — MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [SpeechSynthesis — MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)

---

## 5. Voice (Production Path) — Azure Speech SDK / VoiceLive

> **Not implemented in MVP.** Documented here for upgrade path.

| Field | Value |
|-------|-------|
| **Package** | `microsoft-cognitiveservices-speech-sdk` |
| **Purpose** | Higher accuracy STT/TTS, consistent cross-browser, custom voice models |
| **When to adopt** | When browser Web Speech API accuracy or cross-browser support is insufficient |

### Upgrade Path

1. Add `microsoft-cognitiveservices-speech-sdk` to `src/web/package.json`
2. Create Azure Speech resource (see `resources.yaml` — provisioned but not wired in MVP)
3. Add env vars: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`
4. Replace browser STT hooks with Azure SDK calls:
   ```typescript
   import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
   const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
   speechConfig.speechRecognitionLanguage = 'de-DE';
   speechConfig.speechSynthesisVoiceName = 'de-DE-KatjaNeural';
   ```
5. Implement WebSocket endpoint (`/api/voice`) for real-time streaming via Azure VoiceLive
6. Keep browser Web Speech API as fallback

### Azure VoiceLive (Future)

- Real-time bidirectional audio via WebSocket
- Server-side STT + TTS eliminates browser dependency
- WebSocket protocol defined in `frd-voice.md` §5.2
- MVP stub endpoint already defined: returns error message

---

## 6. Data Storage (MVP) — JSON File Store

| Field | Value |
|-------|-------|
| **Technology** | Node.js `fs.readFile` / `fs.writeFile` |
| **Format** | JSON files |
| **Dependencies** | None (Node.js built-in `fs/promises`) |
| **Purpose** | Simple, zero-dependency persistence for MVP |
| **Why chosen** | No database setup; portable; human-readable; sufficient for single-instance MVP |
| **Capacity** | Up to 1,000 sessions and 100,000 messages (per NFR-18) |

### Wiring

**Env var:**
- `DATA_DIR` — Base directory for data files (default: `./data`)

**File structure:**

```
${DATA_DIR}/
├── sessions.json              # Array of Session objects
├── messages/
│   └── {sessionId}.json       # Array of Message objects per session
└── entities.json              # Array of Entity objects
```

**Atomic write pattern (prevents corruption):**

```typescript
import { writeFile, rename } from 'fs/promises';
import { join } from 'path';

async function atomicWrite(filePath: string, data: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await rename(tempPath, filePath);
}
```

**Init pattern (create directory and files on startup):**

```typescript
import { mkdir, readFile, writeFile } from 'fs/promises';

async function initStore(dataDir: string): Promise<void> {
  await mkdir(join(dataDir, 'messages'), { recursive: true });
  // Create files if they don't exist
  for (const file of ['sessions.json', 'entities.json']) {
    try {
      await readFile(join(dataDir, file));
    } catch {
      await writeFile(join(dataDir, file), '[]', 'utf-8');
    }
  }
}
```

### Key Patterns

- Read entire file → parse → modify → write entire file (simple; fine for MVP scale)
- All writes use atomic pattern (temp file + rename)
- Initialize data directory and empty files on server startup
- Store module exposes async CRUD functions, hides file I/O details
- Per-session message files avoid reading all messages when only one session is needed

### Anti-Patterns

- ❌ Do NOT use synchronous `fs.readFileSync` / `fs.writeFileSync` — blocks event loop
- ❌ Do NOT store data in `node_modules`, `src/`, or any git-tracked directory
- ❌ Do NOT assume `data/` exists — always ensure directory with `mkdir({ recursive: true })`
- ❌ Do NOT write JSON without `JSON.stringify(data, null, 2)` — keep human-readable
- ❌ Do NOT use file locking libraries — use in-memory mutex per resource for concurrent writes

### Docs

- [Node.js fs/promises](https://nodejs.org/api/fs.html#promises-api)

---

## 7. Data Storage (Production Path) — Azure Cosmos DB

> **Not implemented in MVP.** Documented here for upgrade path.

| Field | Value |
|-------|-------|
| **Service** | Azure Cosmos DB for NoSQL |
| **Package** | `@azure/cosmos` |
| **Purpose** | Scalable, globally distributed document database |
| **When to adopt** | When JSON file store exceeds 1,000 sessions / 100,000 messages or multi-instance deployment is needed |

### Upgrade Path

1. Provision Cosmos DB account (see `resources.yaml` — increment 6+)
2. Create database `omasapp` with containers: `sessions`, `messages`, `entities`
3. Add `@azure/cosmos` to `src/api/package.json`
4. Add env vars: `AZURE_COSMOS_ENDPOINT`, `AZURE_COSMOS_KEY` (or use Managed Identity)
5. Replace store module implementations — keep the same interface
6. Partition keys: `sessions` by `id`, `messages` by `sessionId`, `entities` by `type`
7. Add TTL policies for old data if needed

### Data Model Mapping

| JSON File | Cosmos Container | Partition Key |
|-----------|-----------------|---------------|
| `sessions.json` | `sessions` | `/id` |
| `messages/{sessionId}.json` | `messages` | `/sessionId` |
| `entities.json` | `entities` | `/type` |

---

## 8. WebSocket — ws

| Field | Value |
|-------|-------|
| **Package** | `ws` |
| **Version** | `^8.18.0` (to be added in increment 5) |
| **Purpose** | WebSocket server for `/api/voice` endpoint (MVP: stub; production: Azure VoiceLive streaming) |
| **Why chosen** | De facto Node.js WebSocket library; zero-dependency; works with Express/http |

### Wiring

**Install:** `npm install ws` + `npm install -D @types/ws` (in `src/api/`)

**Integration with Express:**

```typescript
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/api/voice' });

wss.on('connection', (ws) => {
  // MVP: send error and close
  ws.send(JSON.stringify({
    type: 'error',
    message: 'Voice WebSocket is not yet implemented. Please use the REST API with browser speech.'
  }));
});

server.listen(PORT);
```

### Key Patterns

- Attach WebSocketServer to the same HTTP server as Express
- Use `path: '/api/voice'` to scope WebSocket connections
- MVP: stub that sends error message and keeps connection open
- Production: handle `audio_chunk`, `start_session`, `end_session` message types

### Anti-Patterns

- ❌ Do NOT use `socket.io` — too heavy for this use case; `ws` is sufficient
- ❌ Do NOT create a separate HTTP server for WebSocket — share with Express

### Docs

- [ws — npm](https://www.npmjs.com/package/ws)
- [ws API](https://github.com/websockets/ws/blob/HEAD/doc/ws.md)

---

## 9. Testing

### 9.1 Vitest (Unit + Integration)

| Field | Value |
|-------|-------|
| **Package** | `vitest` |
| **Version** | `^3.1.0` (in `src/api/package.json`) |
| **Purpose** | Fast unit and integration tests for API |
| **Why chosen** | Already in shell; native TypeScript support; compatible with Jest API; fast |

**Commands:**
- `cd src/api && npm test` — run all tests
- `cd src/api && npm run test:unit` — unit tests only
- `cd src/api && npm run test:integration` — integration tests only

**Key patterns:**
- Supertest for HTTP integration tests (`import request from 'supertest'`)
- Mock Azure OpenAI calls in unit tests (inject fetch mock)
- Use temp directories for file store tests

### 9.2 Playwright (E2E)

| Field | Value |
|-------|-------|
| **Package** | `@playwright/test` |
| **Version** | `^1.58.2` (in root `package.json`) |
| **Purpose** | End-to-end browser tests |
| **Why chosen** | Already in shell; cross-browser; built-in assertions; screenshot comparison |

**Commands:**
- `npm run test:e2e` — all e2e tests
- `npx playwright test --grep @smoke` — smoke tests only

**Config:** `e2e/playwright.config.ts`

**Key patterns:**
- Page Object Models in `e2e/pages/`
- Tests run against Aspire-managed environment
- Tag smoke tests with `@smoke`
- Use `webServer` config for auto-starting services

### 9.3 Cucumber.js (BDD)

| Field | Value |
|-------|-------|
| **Package** | `@cucumber/cucumber` |
| **Version** | `^12.6.0` (in root `package.json`) |
| **Purpose** | Behavior-driven development — Gherkin feature files → step definitions |
| **Why chosen** | Already in shell; connects specs directly to tests |

**Commands:**
- `npm run test:cucumber` — all Cucumber tests

**Structure:**
- Feature files: `specs/features/*.feature`
- Step definitions: `tests/features/step-definitions/**/*.ts`
- Support: `tests/features/support/**/*.ts`
- Config: `cucumber.js` (root)

### Docs

- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)
- [Cucumber.js](https://cucumber.io/docs/cucumber/)

---

## 10. Deployment — Azure Container Apps via AZD

| Field | Value |
|-------|-------|
| **Platform** | Azure Container Apps |
| **CLI** | Azure Developer CLI (`azd`) |
| **IaC** | Bicep (in `infra/`) |
| **Config** | `azure.yaml` (root) |
| **Purpose** | Containerized deployment with auto-scaling, managed TLS, custom domains |
| **Why chosen** | Already in shell; serverless pricing; built-in container registry |

### Wiring

**Services defined in `azure.yaml`:**

| Service | Source | Port | Type |
|---------|--------|------|------|
| `api` | `./src/api` | 8080 | Container App |
| `web` | `./src/web` | 3000 | Container App |
| `docs` | `.` (Dockerfile) | 8080 | Container App |

**Deploy commands:**

| Command | Purpose |
|---------|---------|
| `azd provision` | Create Azure resources |
| `azd deploy` | Build and deploy containers |
| `azd env get-values` | Get deployed URLs |
| `azd down` | Tear down all resources |

**Infra structure:**

```
infra/
├── main.bicep              # Subscription-scoped orchestrator
├── main.parameters.json    # Parameter defaults
├── abbreviations.json      # Resource naming abbreviations
├── core/                   # Shared modules (monitoring, etc.)
│   └── monitor/
│       ├── loganalytics.bicep
│       └── applicationinsights.bicep
└── scripts/
    ├── predeploy.sh        # Pre-deploy hook (Linux)
    └── predeploy.ps1       # Pre-deploy hook (Windows)
```

**Env vars injected at deploy:**

| Var | Source | Target |
|-----|--------|--------|
| `AZURE_CLIENT_ID` | API managed identity | API container |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights | API container |
| `AZURE_OPENAI_ENDPOINT` | Manual / AZD env | API container |
| `AZURE_OPENAI_API_KEY` | Manual / AZD env | API container |
| `AZURE_OPENAI_DEPLOYMENT` | Manual / AZD env | API container |
| `API_BASE_URL` | AZD output | Web container (at build) |

### Key Patterns

- Use `azd env set` to configure Azure OpenAI vars before deploy
- Containers build via Dockerfile in each service directory
- Next.js uses `output: 'standalone'` for minimal container image
- Express listens on `PORT` env var (set by Container Apps to 8080)
- Data dir inside container: `/app/data` (ephemeral — production needs Cosmos DB or mounted volume)

### Anti-Patterns

- ❌ Do NOT store persistent data in container filesystem for production — it's ephemeral
- ❌ Do NOT hardcode URLs — use AZD outputs and env vars
- ❌ Do NOT use `azd deploy` without `azd provision` first

### Docs

- [Azure Developer CLI](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)

---

## 11. Logging — Pino

| Field | Value |
|-------|-------|
| **Package** | `pino` + `pino-http` |
| **Version** | `pino@^9.7.0`, `pino-http@^10.4.0` (in `src/api/package.json`) |
| **Purpose** | Structured JSON logging for API |
| **Why chosen** | Already in shell; fastest Node.js logger; JSON output compatible with Azure Monitor |

### Wiring

```typescript
import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }  // optional dev dependency
    : undefined,
});

// Express middleware
app.use(pinoHttp({ logger }));
```

**Env vars:**
- `LOG_LEVEL` — `debug`, `info`, `warn`, `error` (default: `info`)

### Key Patterns

- Use `logger.info({ sessionId }, 'Session created')` — structured context first, message second
- Use `logger.error({ err, sessionId }, 'Azure OpenAI call failed')` — include error object
- Use `pino-http` middleware for automatic request/response logging
- Child loggers for request-scoped context: `const reqLogger = logger.child({ sessionId })`

### Anti-Patterns

- ❌ Do NOT use `console.log` — use Pino for all logging
- ❌ Do NOT log sensitive data (API keys, full message content in production)
- ❌ Do NOT use synchronous logging transports in production

### Docs

- [Pino](https://getpino.io/)
- [pino-http](https://github.com/pinojs/pino-http)

---

## 12. CSS — Tailwind CSS 4

| Field | Value |
|-------|-------|
| **Package** | `tailwindcss` + `@tailwindcss/postcss` |
| **Version** | `tailwindcss@^4`, `@tailwindcss/postcss@^4` (in `src/web/package.json`) |
| **Purpose** | Utility-first CSS framework for elderly-friendly, accessible UI |
| **Why chosen** | Already in shell; v4 uses CSS-first config; fast builds; design token support |

### Wiring

Tailwind CSS 4 uses CSS-based configuration (no `tailwind.config.js`):

```css
/* src/web/src/app/globals.css */
@import "tailwindcss";

/* OmasApp design tokens */
@theme {
  --font-size-base: 1.125rem;    /* 18px minimum per NFR-13 */
  --font-size-lg: 1.25rem;       /* 20px */
  --font-size-xl: 1.5rem;        /* 24px headings */
  --font-size-2xl: 1.875rem;     /* 30px page titles */
  --color-primary: #1e40af;      /* High contrast blue */
  --color-primary-dark: #1e3a8a;
  --color-surface: #ffffff;
  --color-text: #111827;         /* Near-black for readability */
  --spacing-touch: 3rem;          /* 48px min touch target */
}
```

**PostCSS config (`postcss.config.mjs`):**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

### Key Patterns

- Minimum `text-lg` (18px) for body text per NFR-13
- Minimum `min-h-12 min-w-12` (48px) for all interactive elements per NFR-13
- Use `focus-visible:ring-2 focus-visible:ring-blue-500` for keyboard focus indicators
- Use `motion-safe:` prefix for animations (respects `prefers-reduced-motion`)
- High contrast: `text-gray-900` on `bg-white` (contrast ratio > 4.5:1)

### Anti-Patterns

- ❌ Do NOT create a `tailwind.config.js` — Tailwind v4 uses CSS-first `@theme` directives
- ❌ Do NOT use font sizes smaller than 18px for body text
- ❌ Do NOT use low-contrast color combinations
- ❌ Do NOT use `hover:` without also providing `focus-visible:` styles for keyboard users

### Docs

- [Tailwind CSS 4](https://tailwindcss.com/docs)

---

## 13. Additional Dependencies (Already in Shell)

| Package | Version | Purpose | Location |
|---------|---------|---------|----------|
| `cors` | `^2.8.5` | CORS middleware | `src/api` |
| `helmet` | `^8.1.0` | Security headers | `src/api` |
| `cookie-parser` | `^1.4.7` | Cookie parsing (may be unused in MVP) | `src/api` |
| `react-markdown` | `^10.1.0` | Render markdown in AI responses | `src/web` |
| `tsx` | `^4.19.0` | TypeScript execution for dev | `src/api` (devDep) |
| `supertest` | `^7.1.0` | HTTP assertions in tests | `src/api` (devDep) |
| `concurrently` | `^9.1.0` | Run multiple dev servers | root (devDep) |
| `ts-node` | `^10.9.2` | TypeScript execution for Cucumber | root (devDep) |

### Dependencies to Add Per Increment

| Increment | Package | Location | Purpose |
|-----------|---------|----------|---------|
| 1 (`walking-skeleton`) | `nanoid@^5` | `src/api` | Generate prefixed IDs (`sess_`, `msg_`, `ent_`) |
| 5 (`voice-interaction`) | `ws@^8.18.0` | `src/api` | WebSocket server for voice endpoint |
| 5 (`voice-interaction`) | `@types/ws` | `src/api` (devDep) | TypeScript types for ws |

### Dependencies NOT Needed (Decisions)

| Package | Reason Not Needed |
|---------|-------------------|
| `@azure/openai` | Direct REST calls via fetch — simpler, fewer deps |
| `socket.io` | `ws` is sufficient; no need for Socket.IO's abstractions |
| `mongoose` / `prisma` | JSON file store for MVP; Cosmos SDK for production |
| `bcryptjs` / `jsonwebtoken` | No auth in MVP (shell deps can be removed) |
| `microsoft-cognitiveservices-speech-sdk` | Browser Web Speech API for MVP; SDK for production path only |
| `sqlite3` / `better-sqlite3` | JSON files sufficient for MVP scale |

---

## 14. Environment Variables — Complete Reference

### API Service (`src/api`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | HTTP listen port |
| `NODE_ENV` | No | `development` | Environment mode |
| `DATA_DIR` | No | `./data` | JSON file store directory |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed CORS origin |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `AZURE_OPENAI_ENDPOINT` | Yes* | — | Azure OpenAI resource URL |
| `AZURE_OPENAI_API_KEY` | Yes* | — | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Yes* | — | GPT-4o deployment name |
| `AZURE_OPENAI_DEPLOYMENT_MINI` | No | Falls back to `AZURE_OPENAI_DEPLOYMENT` | GPT-4o-mini deployment for extraction |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | — | Azure Application Insights (production) |

> \* Required for AI features. Without these, API uses echo fallback.

### Web Service (`src/web`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:5001` | API base URL (client-side) |
| `PORT` | No | `3000` | HTTP listen port |

### Local Development `.env` Template

```bash
# src/api/.env
PORT=5001
NODE_ENV=development
DATA_DIR=./data
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug

# Azure OpenAI (optional — echo mode without these)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_DEPLOYMENT_MINI=gpt-4o-mini

# src/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5001
```

---

## 15. Shared Types

Shared TypeScript interfaces live in `src/shared/types/` and are imported by both API and Web:

```typescript
// src/shared/types/session.ts
export interface Session {
  id: string;           // "sess_" + nanoid(12)
  startedAt: string;    // ISO 8601
  endedAt: string | null;
  summary: string | null;
  messageCount: number;
  status: 'active' | 'ended';
}

// src/shared/types/message.ts
export interface Message {
  id: string;           // "msg_" + nanoid(12)
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;    // ISO 8601
}

// src/shared/types/entity.ts
export interface Entity {
  id: string;           // "ent_" + nanoid(12)
  name: string;
  type: 'person' | 'year' | 'place' | 'event';
  context: string;
  relationship: string | null;
  decade: string | null;
  sourceMessageIds: string[];
  sourceSessionIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 16. Technology Decision Log

| # | Decision | Options Considered | Choice | Rationale |
|---|----------|--------------------|--------|-----------|
| TD-01 | AI SDK | `@azure/openai` SDK vs. direct REST | Direct REST via `fetch` | Fewer deps, simpler debugging, full control over retry logic |
| TD-02 | Voice (MVP) | Azure Speech SDK vs. Browser Web Speech API | Browser Web Speech API | Zero cost, no server infra, sufficient for MVP |
| TD-03 | Storage (MVP) | SQLite vs. JSON files vs. Cosmos DB | JSON files | Zero deps, human-readable, sufficient for MVP scale |
| TD-04 | WebSocket | `ws` vs. `socket.io` | `ws` | Lighter, closer to WebSocket standard, no unnecessary abstractions |
| TD-05 | ID generation | `uuid` vs. `nanoid` vs. `crypto.randomUUID` | `nanoid` with prefix | Short, URL-safe, prefixed for debuggability (`sess_`, `msg_`, `ent_`) |
| TD-06 | CSS framework | CSS modules vs. Tailwind vs. styled-components | Tailwind CSS 4 | Already in shell; utility-first fits accessibility-focused design |
| TD-07 | Extraction model | `gpt-4o` for all vs. `gpt-4o-mini` for extraction | `gpt-4o-mini` for extraction | Lower cost; structured extraction doesn't need full model capability |
| TD-08 | Auth (MVP) | API key vs. Managed Identity vs. Entra ID | API key via env var | Simplest for MVP; Managed Identity for production |
| TD-09 | Markdown rendering | Custom parser vs. `react-markdown` | `react-markdown` | Already in shell; safe HTML rendering of AI responses |
| TD-10 | Logging | Winston vs. Pino vs. console | Pino | Already in shell; fastest; structured JSON; Azure Monitor compatible |
