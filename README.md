#        Next.js + TypeScript Shellspec2cloud 

 deploy to Azure.**

spec2cloud is an AI-orchestrated development pipeline. You describe *what* to build; agents handle the * from interactive UI prototypes to production deployment, with human approval at every critical gate.how* 

```
 Deploy
```         

## Why spec2cloud?

| Problem | spec2cloud Solution |
|---------|-------------------|
| AI generates code that doesn't match what you wanted | **UI/UX prototypes** you browse and approve *before* any code is written |
| Generated tests don't cover real user flows | **Gherkin scenarios grounded in prototype  every test traces to a wireframe |screens** 
| Stale APIs, deprecated patterns | **Research & Discovery** queries live docs (Microsoft Learn, Context7, DeepWiki) before implementation |
| Docs are an afterthought | **Auto-generated user manual** with wireframe embeds alongside test screenshots |
| "It works on my machine" | **Aspire orchestration** + **Azure Container Apps** deployment in one command |

## The 8 Phases

| # | Phase | What Happens | Gate |
|---|-------|-------------|------|
| 0 | **Shell Setup** | Scaffold project, verify structure | | 
 FRD breakdown | | 
| 2 | **UI/UX Design** | Interactive HTML wireframes, served for live browsing, replayable walkthrough | | 
| 3 | **Gherkin** | Feature files grounded in prototype screen names and components | | 
| 4 | **Test Generation** | Page Object Models from wireframes, red baseline (all tests  |fail) | 
| 5 | **Contracts** | API specs, shared TypeScript types, infra requirements | | 
 Integration), research-first | | 
| 7 | **Deployment** | Azure Container Apps via  ERROR: no project | exists; to create a new project, run `azd init`, smoke tests | 

### What makes Phase 2 special

UI/UX prototypes aren't throwaway  they're **first-class specs** that persist and ground every downstream phase:wireframes 

- **Served live** via  browse them in your own browser during reviewHTTP 
- **Component inventory** defines the vocabulary for Gherkin scenarios, test selectors, and React components
- **`data-testid` selectors** in prototypes become Page Object Model anchors in Phase 4
- **Replayable walkthrough** (`walkthrough.html`) is embedded in the docs site
- **Feedback flows  if prototyping reveals spec gaps, FRDs/PRD get updated with `[UI-REVISED]` annotationsupstream** 

## Quick Start

```bash
# 1. Create from template
gh repo create my-app --template EmeaAppGbb/spec2cloud-shell-nextjs-typescript
cd my-app && npm install

# 2. Install sub-project dependencies
cd src/web && npm install && cd ../..
cd src/api && npm install && cd ../..

# 3. Run with Aspire (recommended)
npm run dev:aspire          # API + Web + Docs with service discovery

# Or run indi# Or run indi# Or run indi            # concurrently: API (3001) + Web (3000) + Docs (8000)

# 4. Write your PRD and let the agents take over
code specs/prd.md
code specs/prd.md
D and let the agents take over
  # concurrently: APd | Next.js 16, TypeScript, App Router, Tailwind CSS |
| Backend | Express.js, TypeScript, Node.js |
| Testing | Playwright (       Cucumber.js (       Vitest (       Supertest (API) |unit) BDD) e2e) 
| Docs | MkDocs  auto-generated from wireframes + Gherkin + screenshots |Material 
| Orchestration | .NET Aspire (local service discovery & dashboard) |
| Deployment | Azure Container Apps via Azure Developer CLI (`azd`) |
| AI Tools | Microsoft Learn                      Azure Best Practices |DeepWiki Context7 MCP 

## Documentation Pipeline

The docs site combines **design intent** with **living implementation**:

```
  docs/design/        (wireframes, components, walkthrough)
  docs/features/      (Gherkin scenarios + screenshots)
                        docs/index.md       (unified manual with Design + Features sections)
```

Each feature page **embeds the related wireframe prototype** alongside Playwright  showing *what was designed* next to *what was built*.screenshots 

```bash
npm run docs:full     # capture screenshots + generate all docs
npm run docs:serve    # preview at http://localhost:8000
```

## Testing Strategy

Tests are generated in Phase 4 as a **red baseline** (compile but fail). Implementation makes them pass across parallel slices:

```
Per feature:
 [Integration: Cucumber + Playwright]
 [Web Slice: Components + Build]    
```

Page Object Models are derived from Phase 2 wireframe `data-testid`  tests interact with the same UI structure the human approved.selectors 

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:aspire` | Run all services with .NET Aspire |
| `npm run dev:all` | API + Web + Docs concurrently |
| `npm run test:all` | All test suites (unit + BDD + e2e) |
| `npm run docs:full` | Screenshots + generate docs |
| `npm run docs:serve` | Preview docs at localhost:8000 |
| `npm run build:all` | Build API + Web for production |

## Deploy

```bash
azd auth login
azd up              # provision + deploy to Azure Container Apps
```

## Extending

- **Agents** (`.github/ one agent per phase, fully customizable promptsagents/`) 
- **Skills** (`.github/ reusable procedures (build-check, test-runner, spec-validator, research-best-practices, deploy-diagnostics)skills/`) 
- ** swap Next.js/Express for any framework; the pipeline is stack-agnostic at the spec levelStack** 
- **Orchestrator** (`AGENTS. the central brain; modify phases, gates, or add new onesmd`) 

## License

ISC
