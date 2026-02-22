# spec2cloud Shell: Next.js + TypeScript

## What is this?

A spec2cloud shell template for building full-stack applications with:
- **Frontend**: Next.js 16 (TypeScript, App Router, Tailwind CSS)
- **Backend**: Express.js (TypeScript, Node.js)
- **Orchestration**: concurrently (local dev)
- **Deployment**: Azure Container Apps via Azure Developer CLI (azd)
- **Testing**: Playwright (e2e) + Cucumber.js (Gherkin/BDD) + Vitest (unit/integration)
- **Documentation**: MkDocs Material with auto-generated feature docs and screenshots

spec2cloud is an AI-driven development workflow. You write a PRD, and spec2cloud agents handle the rest — reviewing specs, generating tests, implementing features, generating documentation, and deploying to Azure.

## Prerequisites

- Node.js 20+
- Python 3.12+ (for MkDocs documentation)
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

### 3. Set up MCP servers (optional, for Copilot CLI)
```bash
bash scripts/setup-copilot-mcp.sh
```
This reads `.vscode/mcp.json` and configures Copilot CLI's `~/.copilot/mcp-config.json` with the project's MCP servers.

### 4. Run locally
```bash
# Start API, web, and docs servers
npm run dev:all

# Or run services individually:
npm run dev:api    # Express API on port 3001
npm run dev        # Next.js on port 3000
npm run dev:docs   # MkDocs on port 8000
```

### 5. Write your PRD
Edit `specs/prd.md` with your product requirements. See the spec2cloud workflow below for what happens next.

## How spec2cloud Works

spec2cloud uses an AI orchestrator (defined in `AGENTS.md`) that drives your project through 7 phases. Each phase has a specialized agent, and 5 reusable skills provide cross-cutting capabilities.

### The 7 Phases

| Phase | Name | Agent | Human Gate | What Happens |
|-------|------|-------|------------|-------------|
| 0 | Shell Setup | Orchestrator | ✅ | Verify shell structure, scaffold directories |
| 1 | Spec Refinement | `.github/agents/spec-refinement.agent.md` | ✅ | Review PRD for completeness, break into FRDs |
| 2 | Gherkin Generation | `.github/agents/gherkin-generation.agent.md` | ✅ | Convert each FRD into Gherkin feature files |
| 3 | Test Scaffolding | `.github/agents/test-generation.agent.md` | ❌ | Generate test code from Gherkin (red baseline) |
| 4 | Contract Generation | `.github/agents/contract-generation.agent.md` | ✅ | API specs, shared types, and infra contracts |
| 5 | Implementation | `.github/agents/implementation.agent.md` | ✅ | Contract-driven parallel slices make tests pass |
| 6 | Deployment | `.github/agents/deploy.agent.md` | ✅ | Provision Azure resources, deploy, smoke test |

### The 5 Skills

Skills are reusable agent procedures in `.github/skills/` that provide cross-cutting capabilities:

| Skill | Purpose |
|-------|---------|
| `build-check` | Verify API and Web services build successfully before tests or deployment |
| `test-runner` | Execute the appropriate test suite (unit, Gherkin, e2e, smoke) with structured results |
| `spec-validator` | Validate consistency and traceability across the spec chain (PRD → FRD → Gherkin) |
| `deploy-diagnostics` | Diagnose and resolve Azure deployment failures |
| `skill-creator` | Guide for creating new skills to extend agent capabilities |

### Using the Workflow

1. **Write your PRD** in `specs/prd.md`
2. **Start the orchestrator** — open this project in GitHub Copilot (or compatible AI agent) and it will read `AGENTS.md` to begin orchestration
3. **Approve at gates** — the agent pauses at human gates for your review
4. **Watch it build** — the agent generates specs → tests → code → docs → deployment

### State Management

Progress is tracked in `.spec2cloud/state.json` and `.spec2cloud/audit.log`. The orchestrator reads state on startup and resumes where it left off. You can restart the AI session at any time — it will pick up from the last checkpoint.

## Project Structure

```
├── AGENTS.md                        # Orchestrator instructions (7-phase workflow)
├── SPEC2CLOUD.md                    # Project metadata
├── .github/
│   ├── agents/                      # Specialized agent prompts
│   │   ├── spec-refinement.agent.md # Phase 1: PRD/FRD review
│   │   ├── gherkin-generation.agent.md # Phase 2: FRD → Gherkin
│   │   ├── test-generation.agent.md # Phase 3: Gherkin → tests
│   │   ├── contract-generation.agent.md # Phase 4: API specs, shared types, infra contracts
│   │   ├── implementation.agent.md  # Phase 5: Contract-driven parallel slices
│   │   └── deploy.agent.md          # Phase 6: Azure deployment
│   ├── skills/                      # Reusable agent skills
│   │   ├── build-check/             # Build verification skill
│   │   ├── test-runner/             # Test execution skill
│   │   ├── spec-validator/          # Spec chain validation skill
│   │   ├── deploy-diagnostics/      # Deployment troubleshooting skill
│   │   └── skill-creator/           # Skill authoring guide
│   └── copilot-instructions.md      # AI coding conventions
├── specs/                           # Your product specifications
│   ├── prd.md                       # Product Requirements Document (start here!)
│   ├── features/                    # Generated Gherkin .feature files
│   └── contracts/                   # Contracts generated in Phase 4
│       ├── api/                     # API contracts per feature (YAML)
│       └── infra/                   # Infrastructure contract (resources.yaml)
├── src/
│   ├── shared/types/                # Shared TypeScript types (generated in Phase 4)
│   ├── api/                         # Express.js API (TypeScript)
│   │   ├── src/index.ts             # API entry point
│   │   ├── src/routes/              # API route handlers
│   │   ├── src/models/              # Data models
│   │   ├── src/services/            # Business logic
│   │   ├── package.json             # API dependencies
│   │   └── tests/                   # Vitest tests
│   └── web/                         # Next.js 16 frontend
│       └── src/app/                 # App Router pages & components
├── e2e/                             # Playwright end-to-end tests
├── tests/                           # Cucumber.js BDD tests
├── scripts/
│   ├── generate-docs.ts             # Gherkin → MkDocs feature pages
│   └── setup-copilot-mcp.sh         # Configure Copilot CLI MCP servers
├── docs/                            # MkDocs documentation source
├── docs.Dockerfile                  # Containerized docs site (nginx)
├── mkdocs.yml                       # MkDocs Material configuration
├── infra/                           # Azure infrastructure (Bicep)
├── azure.yaml                       # Azure Developer CLI config
├── .spec2cloud/                     # Orchestration state
│   ├── state.json                   # Current phase & progress (per-slice tracking)
│   └── audit.log                    # Action history
└── .github/                         # CI/CD workflows
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `npm run dev` | Start Next.js dev server only |
| Dev All | `npm run dev:all` | Start API, web, and docs servers concurrently |
| API Dev | `npm run dev:api` | Start Express API dev server |
| Docs Dev | `npm run dev:docs` | Start MkDocs dev server on port 8000 |
| Build | `npm run build` | Build the Next.js frontend |
| Build API | `npm run build:api` | Build the Express API |
| Build All | `npm run build:all` | Build both API and web |
| API Tests | `npm run test:api` | Run Vitest API unit tests |
| E2E Tests | `npm run test:e2e` | Run Playwright end-to-end tests |
| BDD Tests | `npm run test:cucumber` | Run Cucumber.js Gherkin tests |
| All Tests | `npm run test:all` | Run all test suites (API + Cucumber + Playwright) |
| Docs Generate | `npm run docs:generate` | Generate MkDocs pages from Gherkin features |
| Docs Screenshots | `npm run docs:screenshots` | Capture screenshots during Cucumber runs |
| Docs Full | `npm run docs:full` | Screenshots + generate (full docs pipeline) |
| Docs Serve | `npm run docs:serve` | Serve docs locally with MkDocs |
| Docs Build | `npm run docs:build` | Build static docs site |

## Documentation Pipeline

spec2cloud auto-generates user-facing documentation from Gherkin features and Playwright screenshots:

1. **Capture screenshots** — `npm run docs:screenshots` runs Cucumber with `GENERATE_SCREENSHOTS=true`, which triggers Playwright to capture screenshots at each scenario step
2. **Generate docs** — `npm run docs:generate` parses `.feature` files and matches them with screenshots to produce MkDocs-compatible markdown pages
3. **Serve locally** — `npm run docs:serve` previews the docs site with MkDocs Material theme
4. **Containerize** — `docs.Dockerfile` builds a static docs site served by nginx (port 8080), deployable to Azure Container Apps

Run the full pipeline in one command:
```bash
npm run docs:full
```

## Testing Strategy

spec2cloud generates a 4-layer test pyramid, partitioned across implementation slices:

1. **Vitest** (TypeScript unit tests) — API slice: individual service/handler methods
2. **Cucumber.js** (`tests/features/`) — Integration slice: BDD scenarios from Gherkin specs
3. **Playwright** (`e2e/`) — Integration slice: full user journey end-to-end tests
4. **Supertest** (API integration tests) — API slice: backend API integration tests

Tests are generated in Phase 3 as a **red baseline** (they compile but fail). Phase 4 generates contracts (API specs, shared types, infra requirements). Phase 5 implements code across parallel slices to make them pass:

```
Per feature:
  [Contracts (Phase 4)] ──┬──> [API Slice: Vitest/Supertest]  ──┬──> [Integration Slice: Cucumber/Playwright]
                          └──> [Web Slice: Build/Components]   ──┘
```

API and Web slices run in parallel against shared TypeScript contract types from Phase 4. The integration slice wires them together and runs Cucumber + Playwright.

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
- **Modify agents** — customize the agent prompts in `.github/agents/` for your workflow
- **Add skills** — create new skills in `.github/skills/` for reusable agent procedures
- **Change models** — update `.spec2cloud/models.json` to use different AI models

The key files to customize are `AGENTS.md` (orchestration behavior) and the agent files in `.github/agents/`.

## License

ISC
