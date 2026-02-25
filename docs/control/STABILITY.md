# Stability

Track whether the development loop remains stable under normal and disturbed conditions.

## Stability Indicators

- Check pass consistency over time (target: 100% on main)
- Low variance in CI cycle time
- Bounded retry counts (max 2 per action)
- Controlled regression rate (< 3% revert rate)

## Disturbance Scenarios

| Scenario | Expected Behavior | Recovery Target |
|---|---|---|
| Dependency upgrade | Temporary check failures | Recover within 1 day |
| Major feature branch | Higher variance in cycle time | Recover within sprint |
| Infra outage | Degraded CI signal | Recover when infra restored |
| Protocol schema change | Downstream rebuild required | Recover within 1 commit cycle |

## Stabilization Playbook

1. Reconfirm setpoints (are targets still realistic?)
2. Reduce surface area of active change (focus on one thing)
3. Enforce stricter checks temporarily (add regression tests)
4. Run entropy cleanup (`make control-nightly`)
