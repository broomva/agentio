# CLAUDE.md — Instructions for Claude Code

## Project Overview

This is **agentio**, a harness-engineered, control-loop governed template for autonomous agent development. It's a TurboRepo monorepo with TypeScript and Bun.

## Before Making Any Changes

1. Read `AGENTS.md` for constraints and conventions
2. Read `PLANS.md` for current phase and context
3. Read `METALAYER.md` for governance and escalation rules
4. Run `make smoke` to confirm the baseline is green

## Key Commands

```bash
make smoke      # Fast sanity check
make test       # Run all tests
make lint       # Run linters
make typecheck  # Type checking
make check      # lint + typecheck
make ci         # Full CI pipeline (smoke + test + check)
make recover    # Automated recovery from failures
make audit      # Harness engineering audit
make control-audit  # Control metalayer audit
```

## Architecture Rules

- `packages/protocol` has ZERO external dependencies
- `packages/kernel-*` depend only on `protocol` — no I/O
- `packages/driver-*` handle all I/O (process spawn, network)
- `apps/*` are entry points, depend on `agent-runtime`
- See `docs/ARCHITECTURE.md` for the full module map

## Workflow

1. Make changes in small, atomic commits
2. Always run `make ci` before declaring work done
3. Never push to main without passing CI
4. New packages require justification in PLANS.md

## File Patterns

- Entry points: `src/index.ts` in each package
- Tests: `__tests__/` within each package
- Scripts: `scripts/harness/` (core) and `scripts/control/` (governance)
- Config: `.control/*.yaml` for policy, `turbo.json` for builds

## What to Avoid

- Don't add dependencies to kernel packages
- Don't modify protocol without updating dependents
- Don't skip CI checks
- Don't store secrets in code or config
- Don't create files outside the established structure
