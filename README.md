# spec2cloud Shell: Next.js + TypeScript

## What is this?

A spec2cloud shell template for building full-stack applications with:
- **Frontend**: Next.js 16 (TypeScript, App Router, Tailwind CSS)
- **Backend**: Express.js (TypeScript, Node.js)
- **Orchestration**: concurrently (local dev)
- **Deployment**: Azure Container Apps via Azure Developer CLI (azd)
- **Testing**: Playwright (e2e) + Cucumber.js (Gherkin/BDD) + Vitest (unit/integration)

spec2cloud is an AI-driven development workflow. You write a PRD, and spec2cloud agents handle the rest — reviewing specs, generating tests, implementing features, and deploying to Azure.

## Prerequisites

- Node.js 20+
- Docker (for containerized deployment)
- Azure Developer CLI (azd) — for Azure deployment
- GitHub Copilot CLI or compatible AI coding agent

## Quick Start

### 1. Clone this template
```bash
git clone <repo-url> my-app
cd my-app
```

### 2. Install dependencies
```bash
npm install
cd src/web && npm install && cd ../..
cd src/api && npm install && cd ../..
```

### 3. Run locally
```bash
# Start both services
npm run dev:all

# Or run services individually:
# API only
cd src/api && npm run dev

# Web only
cd src/web && npm run dev
```

### 4. Write your PRD
Edit `specs/prd.md` with your product requirements. See the spec2cloud workflow below for what happens next.

## How spec2cloud Works

spec2cloud uses an AI orchestrator (defined in `AGENTS.md`) that drives your project through 6 phases. Each phase has a specialized agent and most have human approval gates.

### The 6 Phases

| Phase | Name | Agent | Human Gate | What Happens |
|-------|------|-------|------------|-------------|
| 0 | Shell Setup | Orchestrator | ✅ | Verify shell structure, scaffold directories |
| 1 | Spec Refinement | `agents/spec-refinement.agent.md` | ✅ | Review PRD for completeness, break into FRDs |
| 2 | Gherkin Generation | `agents/gherkin-generation.agent.md` | ✅ | Convert each FRD into Gherkin feature files |
| 3 | Test Scaffolding | `agents/test-generation.agent.md` | ❌ | Generate test code from Gherkin (red baseline) |
| 4 | Implementation | `agents/implementation.agent.md` | ✅ | Contract-first parallel slices make tests pass |
| 5 | Deployment | `agents/deploy.agent.md` | ✅ | Provision Azure resources, deploy, smoke test |

### Using the Workflow

1. **Write your PRD** in `specs/prd.md`
2. **Start the orchestrator** — open this project in GitHub Copilot (or compatible AI agent) and it will read `AGENTS.md` to begin orchestration
3. **Approve at gates** — the agent pauses at human gates for your review
4. **Watch it build** — the agent generates specs → tests → code → deployment

### State Management

Progress is tracked in `.spec2cloud/state.json` and `.spec2cloud/audit.log`. The orchestrator reads state on startup and resumes where it left off. You can restart the AI session at any time — it will pick up from the last checkpoint.

## Project Structure

```
├── AGENTS.md                    # Orchestrator instructions (6-phase workflow)
├── agents/                      # Specialized agent prompts
│   ├── spec-refinement.md       # Phase 1: PRD/FRD review
│   ├── gherkin-generation.md    # Phase 2: FRD → Gherkin
│   ├── test-generation.md       # Phase 3: Gherkin → tests
│   ├── implementation.md        # Phase 4: Contract-first parallel slices
│   └── deploy.md                # Phase 5: Azure deployment
├── specs/                       # Your product specifications
│   ├── prd.md                   # Product Requirements Document (start here!)
│   └── features/                # Generated Gherkin .feature files
├── src/
│   ├── shared/types/            # Contract types (generated in Phase 4)
│   ├── api/                     # Express.js API (TypeScript)
│   │   ├── src/index.ts         # API entry point
│   │   ├── src/routes/          # API route handlers
│   │   ├── src/models/          # Data models
│   │   ├── src/services/        # Business logic
│   │   ├── package.json         # API dependencies
│   │   └── tests/               # Vitest tests
│   └── web/                     # Next.js 16 frontend
│       └── src/app/             # App Router pages & components
├── e2e/                         # Playwright end-to-end tests
├── tests/                       # Cucumber.js BDD tests
├── infra/                       # Azure infrastructure (Bicep)
├── azure.yaml                   # Azure Developer CLI config
├── .spec2cloud/                 # Orchestration state
│   ├── state.json               # Current phase & progress (per-slice tracking)
│   └── audit.log                # Action history
└── .github/                     # CI/CD workflows
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `npm run dev` | Start Next.js dev server only |
| Dev All | `npm run dev:all` | Start both API and web servers |
| API Dev | `npm run dev:api` | Start Express API dev server |
| Build | `npm run build` | Build the Next.js frontend |
| E2E Tests | `npm run test:e2e` | Run Playwright end-to-end tests |
| BDD Tests | `npm run test:cucumber` | Run Cucumber.js Gherkin tests |
| All Tests | `npm run test:all` | Run all test suites |

## Testing Strategy

spec2cloud generates a 4-layer test pyramid, partitioned across implementation slices:

1. **Vitest** (TypeScript unit tests) — API slice: individual service/handler methods
2. **Cucumber.js** (`tests/features/`) — Integration slice: BDD scenarios from Gherkin specs
3. **Playwright** (`e2e/`) — Integration slice: full user journey end-to-end tests
4. **Supertest** (API integration tests) — API slice: backend API integration tests

Tests are generated in Phase 3 as a **red baseline** (they compile but fail). Phase 4 implements code across parallel slices to make them pass:

```
Per feature:
  [Contract Gen] ──┬──> [API Slice: Vitest/Supertest]  ──┬──> [Integration Slice: Cucumber/Playwright]
                   └──> [Web Slice: Build/Components]   ──┘
```

API and Web slices run in parallel against shared TypeScript contract types. The integration slice wires them together and runs Cucumber + Playwright.

## Deploy to Azure

```bash
# Login to Azure
azd auth login

# Provision infrastructure and deploy
azd up
```

This creates Azure Container Apps for the API and web frontend, plus supporting infrastructure (Container Registry, monitoring) defined in `infra/`.

## Customizing the Shell

This template ships with a chat-based UI pattern. You can:

- **Replace the frontend** — swap Next.js for any framework
- **Replace the backend** — swap Express for any Node.js framework
- **Add services** — add databases, caches, or other backends
- **Modify agents** — customize the agent prompts in `agents/` for your workflow
- **Change models** — update `.spec2cloud/models.json` to use different AI models

The key files to customize are `AGENTS.md` (orchestration behavior) and the agent files in `agents/`.

## License

ISC
