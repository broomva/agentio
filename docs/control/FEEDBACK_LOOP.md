# Feedback Loop

Define how observations produce corrective actions.

## Loop Steps

1. **Measure:** Capture sensor outputs (CI results, audit scores, event logs)
2. **Compare:** Compute error against setpoints (see SETPOINTS.md)
3. **Decide:** Choose control action based on error magnitude (see CONTROLLER.md)
4. **Act:** Apply change via allowed actuators (see ACTUATORS.md)
5. **Verify:** Re-measure and close the loop (`make ci` must pass)

## Control Frequency

- **Fast loop (per change):** `make ci` on every commit
- **Daily loop:** Review CI dashboard, check for flaky tests
- **Weekly loop:** Harness audit review, entropy assessment
- **Nightly loop:** Automated `control-nightly` workflow

## Error Budget Policy

- **Error budget metric:** CI failures per week
- **Budget window:** Rolling 7 days
- **Budget exhaustion response:** Freeze new features, focus on stability
