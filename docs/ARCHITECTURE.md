# Architecture

> Module boundaries, typed contracts, and dependency rules.

## Layers

```
┌─────────────────────────────────────────────┐
│  Apps (cli-agent, chat-bot)                 │
├─────────────────────────────────────────────┤
│  Agent Runtime (agent-runtime)              │
├──────────────┬──────────────────────────────┤
│  Drivers     │  Skills Runtime              │
│  (exec, mcp) │  (skills-runtime)            │
├──────────────┴──────────────────────────────┤
│  Kernel (run, policy, artifact, state)      │
├─────────────────────────────────────────────┤
│  Protocol (types, schemas, contracts)       │
└─────────────────────────────────────────────┘
```

## Boundaries

### Protocol Layer (`packages/protocol`)

- **Zero dependencies.** No imports from any other package or external module.
- Defines: RunEnvelope, Event, ArtifactHandle, PolicyRule, ToolContract
- All types exported as TypeScript interfaces AND JSON Schema files
- Changes here require version bump and downstream migration

### Kernel Layer (`packages/kernel-*`)

- Depends **only** on `protocol`
- No I/O operations — pure logic, state machines, and data transforms
- `kernel-run`: Run lifecycle, event emission, workflow state
- `kernel-policy`: Policy evaluation, decision logging, approval flow
- `kernel-artifact`: Artifact handle generation, content-hash computation
- `kernel-state`: Session/run storage interface (adapter pattern)

### Driver Layer (`packages/driver-*`, `packages/skills-runtime`)

- Depends on `protocol` and relevant `kernel-*` packages
- **All I/O happens here** — process spawning, network requests, file system
- `driver-exec`: Subprocess execution via `Bun.spawn`, JSON output normalization
- `driver-mcp`: MCP server communication via JSON-RPC
- `skills-runtime`: Skills.sh integration, skill discovery and execution

### Runtime Layer (`packages/agent-runtime`)

- Depends on kernel, drivers, and skills-runtime
- Wires the AI SDK ToolLoopAgent with the tool registry
- Orchestrates the plan → execute → validate loop
- Emits all events through the kernel event system

### App Layer (`apps/*`)

- Depends on `agent-runtime`
- `cli-agent`: Command-line interface, user interaction, run management
- `chat-bot`: Chat SDK integration, slash commands, approval buttons

## Dependency Direction

```
protocol ← kernel-* ← driver-* ← agent-runtime ← apps/*
                     ← skills-runtime ←┘
```

**Arrows point toward dependencies.** No reverse dependencies allowed.

## Data Flow

```
User/Trigger
    │
    ▼
App (CLI/Chat) → creates RunEnvelope
    │
    ▼
Agent Runtime → plans, invokes tools, processes results
    │                    │
    ▼                    ▼
Kernel.Run          Driver.Exec/MCP
(events, state)     (subprocess, RPC)
    │                    │
    ▼                    ▼
Kernel.Artifact     Kernel.Policy
(store output)      (gate actions)
    │
    ▼
Event Log (append-only)
```

## Package Contracts

Every package must:

1. Export types from `src/index.ts`
2. Include a `tsconfig.json` extending `../../tsconfig.base.json`
3. Include a `package.json` with `build`, `lint`, `typecheck` scripts
4. Have `__tests__/` directory with at least one test
5. Document public API in a `README.md` (when non-trivial)

## Key Design Decisions

- **Content-addressed artifacts** — All outputs are immutable blobs with `artifact://sha256/<hash>` URIs
- **Append-only event log** — Full run provenance, enables `agent replay <run_id>`
- **Policy as YAML data** — Machine-readable, auditable, versionable rules in `.control/policy.yaml`
- **Deterministic tool wrappers** — Every CLI tool wrapped to produce JSON, structured errors, and exit codes
