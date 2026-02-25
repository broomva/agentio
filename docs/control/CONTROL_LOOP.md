# Control Loop

## Loop Definition

1. **Measure** sensor outputs (CI results, audit scores, event logs)
2. **Compare** against setpoints (see SETPOINTS.md)
3. **Select** control action based on error magnitude (see CONTROLLER.md)
4. **Execute** command/action via allowed actuators (see ACTUATORS.md)
5. **Verify** and persist results (`make ci` must pass)

## Minimal Control Law

```
1. Run `smoke`
2. If smoke fails → stop, fix environment/build issues only
3. Run `check` (lint + typecheck)
4. If check fails → block merge, repair static issues
5. Run `test`
6. If test fails → allow bounded retries (max 2), then escalate
7. If failures persist → tighten policy or reduce change surface
```

## Escalation

Escalate when:
- Retries exceed budget (2 attempts)
- Hard policy rules are violated
- Audit score drops below 80%
- Unknown/unrecoverable errors occur

## Gate Sequence

```
smoke → check → test → [web-e2e / cli-e2e] → merge
```

Each gate must pass before proceeding to the next.
