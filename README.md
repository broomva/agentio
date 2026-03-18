# agentio — Agent OS Template

Harness-engineered, control-loop governed autonomous development system.

## What is this?

Agentio is a production-ready template for building autonomous agent systems. It bakes in harness engineering and control-loop governance from the start, so every project bootstrapped from it has deterministic commands, strict module boundaries, and automated recovery built in.

## Stack

- **Runtime:** Bun
- **Build:** TurboRepo monorepo
- **Language:** TypeScript
- **Governance:** Control metalayer with policy enforcement

## Architecture

```
packages/
  protocol/       # Zero-dependency type definitions
  kernel-*/       # Pure logic — depends only on protocol, no I/O
  driver-*/       # All I/O — process spawn, network calls
apps/
  *               # Entry points — depend on agent-runtime
```

Module boundaries are strictly enforced. Kernel packages never perform I/O. Drivers never contain business logic.

## Harness Commands

All critical operations are single deterministic commands:

```bash
make smoke       # Fast sanity check (build + lint)
make test        # Run all tests
make lint        # Lint all packages
make typecheck   # Type-check all packages
make check       # Lint + typecheck combined
make ci          # Full CI pipeline (smoke + test + check)
make recover     # Automated recovery from failures
make audit       # Harness engineering audit
```

## Control Metalayer

The project includes a control-loop governance system defined in `METALAYER.md`:

- **Setpoint:** All harness checks pass (`make ci` exits 0)
- **Sensors:** Test results, lint output, typecheck output, audit scores
- **Escalation:** After 2 failed retries, autonomous work stops and a human is notified
- **Policy:** No unreviewed pushes, no secret exposure, no boundary violations

## Getting Started

```bash
# Clone and install
gh repo clone broomva/agentio my-agent
cd my-agent
bun install

# Verify everything works
make smoke
```

## License

[MIT](LICENSE)
