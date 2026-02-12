# .spec2cloud — State Persistence

This directory holds the persistent state that lets spec2cloud resume from any point after a session interruption. Both files are committed to the repository.

| File | Purpose |
|------|---------|
| `state.json` | Current position — what phase we're in, what's done, what's next. |
| `audit.log` | Full history — every action the orchestrator has taken, in order. |

## Why state is committed to the repo

- **Shared across machines** — any developer (or CI agent) can clone the repo and resume exactly where the last session left off.
- **Visible in git history** — every `state.json` change is a commit, giving a natural timeline of project progression.
- **No external dependencies** — no database, no cloud service, no session cookies. The repo is the single source of truth.
- **Reproducible** — `git log --oneline -- .spec2cloud/state.json` shows every state transition.

## How the orchestrator uses state

### Startup: read & validate

```
1. Read .spec2cloud/state.json (or create a fresh one if missing).
2. Validate against state-schema.json.
3. Set currentPhase as the entry point for the orchestrator loop.
```

If validation fails (e.g. a schema upgrade added new fields), the orchestrator applies safe defaults for missing fields and logs a warning to `audit.log`.

### Loop iteration: act & persist

Each iteration of the orchestrator loop follows this cycle:

```
1. Perform one action in the current phase.
2. Update phaseState with the results.
3. Check if the phase is complete → if yes, advance currentPhase.
4. Write state.json to disk.
5. Append an entry to audit.log.
6. Commit both files: git add .spec2cloud/ && git commit -m "spec2cloud: {action summary}"
```

State is written **after every action**, not just at the end of a phase. This means an interruption at any point loses at most one action.

### Resume: read → re-validate → continue

When a new session starts (or the same session reconnects), the orchestrator:

1. Reads `state.json` and picks up at `currentPhase`.
2. Inspects `phaseState` to determine exactly where within the phase to resume.
3. Continues the loop from that point.

For example, if `currentPhase` is `implementation` and `currentFeature` is `FRD-002` with `currentIteration` at `4`, the orchestrator resumes the TDD loop for FRD-002 at iteration 5.

### Human gates

At certain transitions the orchestrator pauses and waits for human approval:

| Gate | Condition |
|------|-----------|
| PRD approval | `humanGates.prdApproved` must be `true` to leave spec-refinement. |
| FRD approval | `humanGates.frdApproved` must be `true` to start gherkin-generation. |
| Gherkin approval | `humanGates.gherkinApproved` must be `true` to start test-generation. |
| Implementation approval | `humanGates.implementationApproved` must be `true` to start deployment. |
| Deployment approval | `humanGates.deploymentApproved` must be `true` to run `azd deploy`. |

When a gate is not yet approved, the orchestrator logs a `human-gate-pending` event and exits cleanly so the user can review and re-run.

## How to reset state

To start a project from scratch:

```bash
rm .spec2cloud/state.json .spec2cloud/audit.log
git add .spec2cloud/ && git commit -m "spec2cloud: reset state"
```

The orchestrator will create a fresh `state.json` on the next run.

To re-enter a specific phase, edit `state.json` manually:

```bash
# Re-run implementation from the beginning
jq '.currentPhase = "implementation" | .phaseState.implementation.completedFeatures = [] | .phaseState.implementation.currentFeature = null | .phaseState.implementation.currentIteration = 0' \
  .spec2cloud/state.json > tmp.json && mv tmp.json .spec2cloud/state.json
```

## State vs. audit log

| | `state.json` | `audit.log` |
|-|--------------|-------------|
| **What** | Current snapshot | Append-only history |
| **Updated** | Overwritten each action | Appended each action |
| **Used by** | Orchestrator (resume logic) | Humans & debugging |
| **Size** | Small, constant | Grows over time |
| **Format** | JSON (schema-validated) | One-line-per-event text |

Together they give both a "where are we now?" answer (`state.json`) and a "how did we get here?" answer (`audit.log`). See [audit-log-format.md](audit-log-format.md) for the log's line format and standard actions.
