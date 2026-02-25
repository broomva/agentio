# Observability

> Structured logging, tracing, and metrics for agent runs.

## Required Event Fields

Every event emitted during a run MUST include:

```typescript
interface BaseEvent {
  run_id: string;       // UUID — unique per run
  step_id: number;      // Monotonically increasing within run
  event: string;        // Event type (e.g., "tool.called")
  timestamp: string;    // ISO 8601 with timezone
  agent_id: string;     // Identifier for the agent instance
}
```

## Event Types

| Event               | Additional Fields                              | When Emitted                    |
|---------------------|-----------------------------------------------|---------------------------------|
| `run.started`       | `envelope: RunEnvelope`                       | Run begins                      |
| `run.completed`     | `summary: RunSummary`                         | Run succeeds                    |
| `run.failed`        | `error: StructuredError`                      | Run fails                       |
| `tool.called`       | `tool: string, args: object`                  | Before tool execution           |
| `tool.result`       | `tool: string, result: any, exit_code: number`| After tool execution            |
| `artifact.created`  | `uri: string, size: number, mime: string`     | New artifact stored             |
| `policy.decision`   | `action: string, decision: ALLOW\|DENY, reason`| Policy evaluation             |
| `policy.approval`   | `action: string, approved_by: string`         | Human approves gated action     |
| `metric.recorded`   | `name: string, value: number, unit: string`   | Metric data point               |

## Structured Logging Rules

1. **JSON only** — No free-text logs in production. Use structured fields.
2. **Correlation IDs** — Every log line includes `run_id`. Cross-service calls include `trace_id`.
3. **No secrets** — Log `secret://<id>` handles, never actual values.
4. **Severity levels** — `debug`, `info`, `warn`, `error`, `fatal`.
5. **Deterministic output** — Same input produces same log structure (timestamps excluded).

## Log Format

```json
{
  "level": "info",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "step_id": 3,
  "event": "tool.called",
  "tool": "exec:git-diff",
  "args": {"from": "main", "to": "workspace"},
  "timestamp": "2026-02-24T12:34:56.789Z",
  "agent_id": "cli-agent@0.1.0"
}
```

## Metrics Collection

### Per-Run Metrics

- `run.duration_ms` — Total run time
- `run.tool_calls` — Number of tool invocations
- `run.artifacts_created` — Number of artifacts stored
- `run.policy_decisions` — Count of policy evaluations
- `run.errors` — Count of tool/system errors

### Per-Command Metrics (Harness)

- `harness.smoke.duration_ms`
- `harness.test.duration_ms`
- `harness.test.pass_count`
- `harness.test.fail_count`
- `harness.lint.warnings`
- `harness.lint.errors`
- `harness.typecheck.errors`

## Tracing

For distributed scenarios (multi-agent, remote MCP):

- Use OpenTelemetry-compatible trace/span IDs
- Parent span = the run itself
- Child spans = individual tool calls
- Propagate context headers in MCP/A2A calls

## Alerting Thresholds

| Condition                     | Alert Level | Action                    |
|-------------------------------|-------------|---------------------------|
| `run.failed` event            | ERROR       | Log, notify, pause        |
| `policy.decision:DENY`        | WARN        | Log, block action         |
| Run duration > budget         | ERROR       | Terminate run             |
| Token usage > 80% of budget   | WARN        | Log warning               |
| Nightly audit score < 80%     | ERROR       | Create remediation issue  |
