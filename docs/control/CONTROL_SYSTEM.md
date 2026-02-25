# Control System Model

## Purpose

Use this document to keep the repository's autonomous development loop explicit and stable.

## System Definition

- **Setpoint:** All harness checks pass (`make ci` = exit 0), audit scores = 100%
- **Plant:** The repository codebase and its runtime behavior
- **Controller:** Agent + harness scripts + policy engine (METALAYER.md)
- **Actuators:** Code edits, config changes, dependency updates, script modifications
- **Sensors:** CI results, lint output, typecheck output, audit scores, event logs
- **Feedback channels:** CI pipeline results, nightly audit reports, drift detection
- **Disturbances:** External dependency changes, API schema drift, human edits

## Maturity Targets

- **Stability target:** All harness commands deterministic and reproducible
- **Adaptation target:** New packages integrate within 1 commit cycle
- **Recovery target:** `make recover` resolves 80%+ of common failures

## Review Cadence

- **Weekly harness review owner:** Project lead
- **Monthly architecture review owner:** Architecture team
- **Entropy cleanup cadence:** Quarterly
