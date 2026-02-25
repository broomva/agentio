# Controller

Describe the policy and logic that decides corrective actions.

## Control Policy

- **Primary control objective:** Keep all harness checks green
- **Secondary objectives:** Minimize entropy drift, maintain doc/code sync
- **Priority order:** Safety > Correctness > Performance > Features

## Control Inputs

- **Required signals:** CI status, audit scores, policy decision logs
- **Input freshness constraints:** CI results must be from current commit
- **Input confidence thresholds:** Audit scores must be deterministic (no flaky checks)

## Control Actions

1. Tighten constraints (update policy.yaml, add stricter lint rules)
2. Adjust evaluation scope (add/remove test targets)
3. Escalate to human review (when retries exhausted)
4. Trigger refactor cleanup (when entropy score degrades)

## Escalation Rules

- **Escalation trigger:** 2 consecutive CI failures or policy violation
- **Escalation owner:** Project lead
- **Maximum autonomous retries:** 2
