# PLANS.md

> Durable context for agents and developers. Updated as project evolves.
> This is the "what are we doing and why" document.

## Current Phase: Foundation (Phase 1)

### Objective

Establish the harness-engineered, control-loop governed template repo with all scaffolding, documentation, and automation in place before writing application logic.

### What We Have

- TurboRepo monorepo with bun workspaces
- Full harness engineering artifacts (AGENTS.md, Makefile.harness, CI workflows)
- Control metalayer (METALAYER.md, .control/ primitives, audit scripts)
- Architecture documentation with strict module boundaries
- Observability framework with structured logging spec
- GitHub Actions CI for harness validation and control audits
- Nightly entropy/drift detection

### What's Next (Phase 2: Kernel)

1. Implement `packages/protocol` — Run Envelope, Event, Artifact, and Policy JSON Schemas
2. Implement `packages/kernel-run` — Run state machine, event emitter
3. Implement `packages/kernel-policy` — Rule-based policy engine
4. Implement `packages/kernel-artifact` — Content-addressed artifact store interface

### Phase 3: Drivers & Runtime

1. Implement `packages/driver-exec` — Bun.spawn wrapper with JSON output normalization
2. Implement `packages/driver-mcp` — MCP JSON-RPC client
3. Implement `packages/skills-runtime` — Skills.sh integration
4. Implement `packages/agent-runtime` — AI SDK ToolLoopAgent wiring

### Phase 4: Apps & Integration

1. Implement `apps/cli-agent` — CLI commands (self-improve, replay, inspect)
2. Implement `apps/chat-bot` — Chat SDK integration
3. Evaluation suite — automated fitness function
4. End-to-end testing

## Pain Points Identified

- Agent context window limits require front-loaded, compact documentation
- Non-deterministic tool outputs need strict JSON wrapping
- Policy enforcement must happen at the kernel level, not in drivers
- Drift between docs and code is the primary entropy source

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| TurboRepo + Bun monorepo | Shared types, incremental builds, single CI, fast runtime |
| Bun runtime + package manager | Fast startup, native TypeScript, Bun.spawn, built-in workspaces |
| Protocol-first | All schemas defined before implementation prevents drift |
| Content-addressed artifacts | Immutable, deduplicable, replay-friendly |
| Policy as data (YAML) | Auditable, versionable, machine-readable |
| Append-only event log | Full provenance, replayability, audit trail |

## Constraints

- Node >= 22.0.0
- TypeScript strict mode everywhere
- Zero tolerance for lint/typecheck failures in CI
- Every commit must pass `make ci`
