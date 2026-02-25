# Sensors

List the signals used to evaluate whether the system is on target.

## Required Sensors

- CI results (lint/typecheck/test/smoke)
- Structured runtime events (run.started, tool.called, tool.result)
- Trace spans for long workflows
- Audit script outputs (harness + control)
- Policy decision logs

## Signal Contracts

| Sensor | Required Fields | Sampling | Storage |
|---|---|---|---|
| Harness events | run_id, step_id, event, timestamp | Always | Event log |
| CI checks | check_name, status, duration_ms | Always | CI provider |
| Audit results | file, status (ok/missing), total_score | Per audit | Logs |
| Policy decisions | action, decision, reason | Always | Event log |

## Sensor Gaps

- Missing signals: Performance regression detection (planned for Phase 3)
- Noisy/unreliable signals: External API latency (mitigated by timeouts)
- Planned remediation: Add OpenTelemetry tracing in Phase 2
