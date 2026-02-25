# AGENTS.md

> Compact, constraint-focused guide for AI agents operating on this repository.
> Keep this file short. Link to docs/ for deep context.

## Repository Identity

- **Name:** agentio (Agent OS template)
- **Stack:** TypeScript, TurboRepo monorepo, pnpm, Bun runtime
- **Purpose:** Harness-engineered, control-loop governed autonomous development system

## Harness Commands

All critical operations are single deterministic commands:

| Command         | What it does                          | Script                         |
|-----------------|---------------------------------------|--------------------------------|
| `make smoke`    | Fast sanity check (build + lint)      | `scripts/harness/smoke.sh`     |
| `make test`     | Run all tests                         | `scripts/harness/test.sh`      |
| `make lint`     | Lint all packages                     | `scripts/harness/lint.sh`      |
| `make typecheck`| Type-check all packages               | `scripts/harness/typecheck.sh` |
| `make check`    | Lint + typecheck combined             | Makefile.harness               |
| `make ci`       | Full CI pipeline (smoke+test+check)   | Makefile.harness               |
| `make recover`  | Attempt automated recovery            | `scripts/control/recover.sh`   |
| `make web-e2e`  | Web end-to-end tests                  | `scripts/control/web_e2e.sh`   |
| `make cli-e2e`  | CLI end-to-end tests                  | `scripts/control/cli_e2e.sh`   |

## Execution Plans

Before making changes:

1. Read `PLANS.md` for current project phase and constraints
2. Read `METALAYER.md` for governance rules and escalation policies
3. Run `make smoke` to confirm baseline is green
4. Make changes in small, atomic commits
5. Run `make ci` before declaring work done
6. Never push without passing `make ci`

## Module Boundaries

See `docs/ARCHITECTURE.md` for the full module map. Key rules:

- `packages/protocol` has **zero** external dependencies — it defines types only
- `packages/kernel-*` depend only on `protocol` — no IO, no side effects
- `packages/driver-*` perform all IO — spawning processes, network calls
- `apps/*` depend on `agent-runtime` — they are the entry points

**Violations of these boundaries are blocking errors.**

## File Conventions

- Every package has `src/index.ts` as its entry point
- Tests live in `__tests__/` within each package
- Scripts are executable shell scripts (`chmod +x`)
- Config files use YAML in `.control/`, JSON elsewhere

## Observability

- Every tool call must include a `run_id` and `step_id`
- Structured JSON logs only — no `console.log` in production code
- See `docs/OBSERVABILITY.md` for required event fields

## Policy

- No destructive git operations without human approval
- No network egress without explicit policy allowance
- No secret values in logs — use `secret://` handles
- See `.control/policy.yaml` for the full policy ruleset

## What NOT to Do

- Do not modify `packages/protocol` without updating all dependents
- Do not add dependencies to kernel packages
- Do not skip `make ci` before committing
- Do not create files outside the established directory structure
- Do not store secrets in source code or config files
