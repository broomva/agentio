# METALAYER.md

> Control-loop governance for autonomous development.
> This document defines how the system regulates itself.

## Control System Model

### Definition

| Element       | Description                                                    |
|---------------|----------------------------------------------------------------|
| **Setpoint**  | All harness checks pass (`make ci` = 0 exit code)             |
| **Plant**     | The repository codebase and its runtime behavior               |
| **Controller**| Agent + harness scripts + policy engine                        |
| **Actuators** | Code edits, config changes, dependency updates                 |
| **Sensors**   | Test results, lint output, typecheck output, audit scores      |
| **Feedback**  | CI pipeline results, nightly audit reports, drift detection    |
| **Disturbances** | External dependency changes, API schema drift, human edits  |

### Control Law (Minimal)

```
error = setpoint - measured_state
if error > threshold:
    plan_correction(error)
    apply_correction()
    measure_again()
    if still_failing:
        escalate_to_human()
```

## Governance Rules

### Policy Enforcement

All policies are defined in `.control/policy.yaml`. Key rules:

1. **No unreviewed pushes** — Every push must pass `make ci` first
2. **No secret exposure** — Secrets use `secret://` handles, never plaintext
3. **No boundary violations** — Module dependencies are strictly directional
4. **No silent failures** — Every tool must return structured exit codes
5. **No drift tolerance** — Nightly audits flag any doc/code divergence

### Escalation Rules

| Trigger                          | Action                              | Owner   |
|----------------------------------|-------------------------------------|---------|
| `make ci` fails after 2 retries | Stop autonomous work, notify human  | Agent   |
| Policy violation detected        | Block action, log event, alert      | Policy  |
| Audit score drops below 80%     | Create remediation issue            | Nightly |
| Unknown error in tool execution  | Log full context, pause, escalate   | Agent   |
| Entropy score exceeds threshold  | Schedule cleanup sprint             | Nightly |

### Maximum Autonomous Retries: 2

If a corrective action fails twice, the agent must escalate rather than retry.

## Metrics

Track these metrics per run and per week:

| Metric                | Target    | Measurement                              |
|-----------------------|-----------|------------------------------------------|
| CI pass rate          | 100%      | `make ci` exit code                      |
| Harness audit score   | 100%      | `scripts/audit_harness.sh` output        |
| Control audit score   | 100%      | `scripts/audit_control.sh` output        |
| Mean recovery time    | < 5 min   | Time from failure detection to green CI  |
| Drift incidents/week  | 0         | Nightly audit delta                      |
| Policy violations     | 0         | Event log `policy.decision:DENIED` count |

## Maturity Targets

- **Stability:** All harness commands deterministic and reproducible
- **Adaptation:** New packages integrate within 1 commit cycle
- **Recovery:** Automated recovery resolves 80%+ of common failures

## Review Cadence

- **Weekly:** Harness review — check audit scores, review drift
- **Monthly:** Architecture review — validate module boundaries
- **Quarterly:** Entropy cleanup — remove stale abstractions, update docs

## Stable Command Surface

Commands that MUST NOT change names (wrappers may change internals):

- `smoke`, `check`, `test`, `lint`, `typecheck`, `ci`
- `recover`, `web-e2e`, `cli-e2e`
- `audit` (harness), `control:audit` (metalayer)
