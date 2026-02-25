/**
 * @agentio/kernel-run — Run lifecycle management
 *
 * Create, track, and finalise agent runs.
 * Manages run envelopes, step counters, and completion summaries.
 */

import type { RunEnvelope, RunSummary, AgentEvent } from "@agentio/protocol";

/** Placeholder: create a new run from an envelope */
export function createRun(_envelope: RunEnvelope): { runId: string } {
  return { runId: _envelope.run_id };
}

/** Placeholder: append an event to a run's event log */
export function appendEvent(_runId: string, _event: AgentEvent): void {
  // TODO: implement event appending
}

/** Placeholder: finalise a run and produce a summary */
export function finaliseRun(_runId: string): RunSummary {
  return {
    run_id: _runId,
    status: "completed",
    duration_ms: 0,
    tool_calls: 0,
    artifacts_created: 0,
    errors: 0,
  };
}
