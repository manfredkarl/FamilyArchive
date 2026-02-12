# Copilot Instructions

## Project Overview
This project uses the **spec2cloud** framework — a spec-driven development process
where specifications (PRD → FRD → Gherkin) are the source of truth, and implementation
is driven by automated tests generated from those specifications.

## Framework
- Orchestration: See `AGENTS.md` for the master orchestrator instructions
- Sub-agents: See `.github/agents/*.agent.md` for specialized agent instructions
- State: See `.spec2cloud/state.json` for current project state
- Audit: See `.spec2cloud/audit.log` for execution history

## Coding Conventions
- Write minimal code to pass tests — no gold-plating
- Follow existing patterns in the codebase
- All code must be covered by tests (unit, integration, or e2e)
- No hardcoded secrets — use environment variables
- No hardcoded URLs — use configuration
- Error handling: every external call must have error handling
- Logging: use structured logging (not console.log/print)
- Comments: only when code intent is non-obvious

## Spec-Driven Development Rules
- **Never implement features not in the specs** (specs/frd-*.md)
- **Never modify tests** without human approval — tests are the contract
- **Always check Gherkin scenarios** before implementing a feature
- **Always run tests** after making changes
- If a spec seems wrong, flag it — do not silently deviate

## File Organization
```
specs/          → Specifications (PRD, FRDs, Gherkin)
e2e/            → Playwright end-to-end tests
tests/          → Unit and integration tests
src/            → Application source code
infra/          → Azure infrastructure (Bicep)
.spec2cloud/    → Framework state and config
```

## Git Conventions
- Commit messages: `[phase] brief description` (e.g., `[impl] add user auth login endpoint`)
- Branch naming: `spec2cloud/{phase}/{feature}` (e.g., `spec2cloud/impl/user-auth`)
- Always commit `.spec2cloud/state.json` and `.spec2cloud/audit.log` with changes
- Never commit secrets, .env files, or node_modules

## Testing Hierarchy
1. **Unit tests** — fastest feedback, run on every change
2. **Gherkin step definitions** — behavioral tests, run per feature
3. **Playwright e2e** — full user journey tests, run after feature completion
4. **Smoke tests** — post-deployment verification

## Human Gates
The agent MUST pause and ask for human approval at these points:
- After PRD review (before FRD breakdown)
- After FRD review (before Gherkin generation)
- After Gherkin generation (before test generation)
- After implementation (before deployment) — via PR review
- After deployment (if smoke tests fail)

## State Management
- Read `.spec2cloud/state.json` at the start of every session
- Update it after completing each task
- Append to `.spec2cloud/audit.log` after every action
- If state.json is missing, start from Phase 0

## Shell-Specific Extensions
<!-- Shells should add stack-specific instructions below this line -->
<!-- Examples: language-specific conventions, framework patterns, test commands -->

### TypeScript/Node.js Conventions (Backend — src/api/)

- **Express with TypeScript**: Define routes using modular route files in `src/routes/` — no monolithic route file
- **Async/await**: All I/O-bound operations must be async. Use proper error handling with try/catch
- **Strict TypeScript**: `strict: true` in tsconfig — no `any` types, no implicit returns, explicit null checks
- **Dependency Injection**: Use constructor injection or factory functions for testability. Register dependencies in `app.ts`
- **Response helpers**: Use `res.json()` for success, `res.status(4xx).json({ error })` for errors — consistent error shape
- **Configuration**: Use environment variables via `process.env`. Use a config module for validation and defaults
- **Error handling**: Use Express error middleware for global error handling; return consistent `{ error, details? }` shape
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces, kebab-case for file names
- **Structured logging**: Use `pino` logger — no `console.log` in production code
- **Input validation**: Validate request bodies at the route level before passing to services

### Next.js/React Conventions (Frontend — src/web/)

- **Server Components by default**: Only add `'use client'` when the component needs hooks, event handlers, or browser APIs
- **App Router**: Use `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` conventions — no `pages/` directory
- **Route handlers**: API routes at `src/app/api/{route}/route.ts` — export named HTTP method functions
- **TypeScript strict mode**: Enabled — no `any` types, no implicit returns, explicit null checks
- **Tailwind CSS**: Use utility classes for all styling — avoid custom CSS files or CSS-in-JS
- **Component naming**: PascalCase for components, kebab-case for directories
- **Data fetching**: Server Components fetch at render time; Client Components use `useEffect` or SWR
- **Image optimization**: Use `next/image` for all images — no raw `<img>` tags
- **Link navigation**: Use `next/link` for internal navigation — no raw `<a>` tags for internal routes

### Test Framework Conventions

- **Vitest**: Use `describe()` for grouping, `it()` or `test()` for individual tests. Use `vi.mock()` for mocking dependencies
- **Supertest**: Use `request(app).get('/path')` for HTTP-level testing of Express routes — no need to start a real server
- **Cucumber.js**: Use `@cucumber/cucumber` imports. Step definitions in `tests/features/step-definitions/`. Tags for filtering: `@smoke`, `@api`, `@ui`
- **Playwright**: Use `test.describe()` for grouping, `test()` for individual tests. Page Object Model in `e2e/pages/`. No hardcoded waits — use auto-waiting locators
- **Test naming**: `it('should [behavior] when [condition]')` for Vitest, exact Gherkin step text for Cucumber
- **Test isolation**: Each test must be independent — no shared mutable state between tests
- **No hardcoded waits**: Use Playwright auto-waiting, Vitest async assertions, or polling patterns
