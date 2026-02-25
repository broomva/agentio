# Setpoints

Define numeric targets for the autonomous development loop.

## Core Setpoints

| Metric | Target | Alert Threshold | Owner |
|---|---|---|---|
| CI pass rate | 100% | < 95% | CI pipeline |
| Harness audit score | 100% | < 80% | Harness scripts |
| Control audit score | 100% | < 80% | Control scripts |
| Time to actionable failure | < 5 min | > 15 min | Observability |
| Human intervention rate | < 20% | > 40% | Agent runtime |
| Revert rate | < 3% | > 8% | Git workflow |

## Constraints

- **Required quality gates:** lint, typecheck, test must all pass before merge
- **Security constraints:** No secrets in logs, policy approval for destructive ops
- **Cost/runtime constraints:** Max 1 hour per run, max 100k tokens
