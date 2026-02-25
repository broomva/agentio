/**
 * @agentio/kernel-run — Run lifecycle management
 *
 * State machine for agent runs: pending → running → completed/failed/cancelled.
 * Manages run envelopes, step counters, event logging, and completion summaries.
 *
 * Pure logic — no I/O. All state is held in memory.
 */

import type {
  RunEnvelope,
  RunSummary,
  RunStatus,
  AgentEvent,
  BaseEvent,
  EventType,
  StructuredError,
} from "@agentio/protocol";
import { createEvent, now } from "@agentio/protocol";

// ─── Run State ──────────────────────────────────────────────────────────────

export interface RunState {
  envelope: RunEnvelope;
  status: RunStatus;
  step: number;
  events: AgentEvent[];
  started_at: string | null;
  finished_at: string | null;
  error: StructuredError | null;
  tool_calls: number;
  artifacts_created: number;
  errors: number;
}

// ─── Transition Table ───────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ─── Event Listener ─────────────────────────────────────────────────────────

export type RunListener = (event: AgentEvent, run: RunState) => void;

// ─── RunManager ─────────────────────────────────────────────────────────────

export class RunManager {
  private runs = new Map<string, RunState>();
  private listeners: RunListener[] = [];

  /** Register a listener for all run events. */
  on(listener: RunListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: AgentEvent, run: RunState): void {
    for (const listener of this.listeners) {
      listener(event, run);
    }
  }

  /** Create a new run in pending state. */
  create(envelope: RunEnvelope): RunState {
    if (this.runs.has(envelope.run_id)) {
      throw new Error(`Run ${envelope.run_id} already exists`);
    }
    const state: RunState = {
      envelope,
      status: "pending",
      step: 0,
      events: [],
      started_at: null,
      finished_at: null,
      error: null,
      tool_calls: 0,
      artifacts_created: 0,
      errors: 0,
    };
    this.runs.set(envelope.run_id, state);
    return state;
  }

  /** Get a run by ID, or null if not found. */
  get(runId: string): RunState | null {
    return this.runs.get(runId) ?? null;
  }

  /** List all runs. */
  list(): RunState[] {
    return Array.from(this.runs.values());
  }

  /** Transition a run to "running" and emit run.started. */
  start(runId: string): AgentEvent {
    const run = this.require(runId);
    this.transition(run, "running");
    run.started_at = now();
    const event = this.recordEvent(run, "run.started");
    return event;
  }

  /** Append an event to a run and advance the step counter. */
  append(runId: string, eventType: EventType): AgentEvent {
    const run = this.require(runId);
    if (run.status !== "running") {
      throw new Error(`Cannot append events to run in "${run.status}" state`);
    }
    const event = this.recordEvent(run, eventType);
    // Track counters based on event type
    if (eventType === "tool.called") run.tool_calls++;
    if (eventType === "artifact.created") run.artifacts_created++;
    if (eventType === "run.failed") run.errors++;
    return event;
  }

  /** Complete a run successfully. */
  complete(runId: string): RunSummary {
    const run = this.require(runId);
    this.transition(run, "completed");
    run.finished_at = now();
    this.recordEvent(run, "run.completed");
    return this.buildSummary(run);
  }

  /** Fail a run with an error. */
  fail(runId: string, error: StructuredError): RunSummary {
    const run = this.require(runId);
    this.transition(run, "failed");
    run.finished_at = now();
    run.error = error;
    run.errors++;
    this.recordEvent(run, "run.failed");
    return this.buildSummary(run);
  }

  /** Cancel a run. */
  cancel(runId: string): RunSummary {
    const run = this.require(runId);
    this.transition(run, "cancelled");
    run.finished_at = now();
    this.recordEvent(run, "run.completed"); // completed with cancelled status
    return this.buildSummary(run);
  }

  /** Get the current step counter for a run. */
  currentStep(runId: string): number {
    return this.require(runId).step;
  }

  /** Get all events for a run. */
  events(runId: string): AgentEvent[] {
    return this.require(runId).events.slice();
  }

  /** Check if a run has exceeded its time budget. */
  isOverBudget(runId: string): { time: boolean; tokens: boolean } {
    const run = this.require(runId);
    const elapsed = run.started_at
      ? Date.now() - new Date(run.started_at).getTime()
      : 0;
    return {
      time: elapsed > run.envelope.budgets.max_time_ms,
      tokens: false, // token tracking requires external input
    };
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private require(runId: string): RunState {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    return run;
  }

  private transition(run: RunState, to: RunStatus): void {
    if (!canTransition(run.status, to)) {
      throw new Error(
        `Invalid transition: ${run.status} → ${to} for run ${run.envelope.run_id}`
      );
    }
    run.status = to;
  }

  private recordEvent(run: RunState, eventType: EventType): AgentEvent {
    const event = createEvent(
      run.envelope.run_id,
      run.envelope.agent_id,
      run.step,
      eventType,
    ) as AgentEvent;
    run.events.push(event);
    run.step++;
    this.emit(event, run);
    return event;
  }

  private buildSummary(run: RunState): RunSummary {
    const startTime = run.started_at
      ? new Date(run.started_at).getTime()
      : Date.now();
    const endTime = run.finished_at
      ? new Date(run.finished_at).getTime()
      : Date.now();
    return {
      run_id: run.envelope.run_id,
      status: run.status as "completed" | "failed" | "cancelled",
      duration_ms: endTime - startTime,
      tool_calls: run.tool_calls,
      artifacts_created: run.artifacts_created,
      errors: run.errors,
    };
  }
}

// ─── Convenience: singleton instance ────────────────────────────────────────

let _default: RunManager | null = null;

export function getDefaultRunManager(): RunManager {
  if (!_default) _default = new RunManager();
  return _default;
}

/** Reset the default instance (for testing). */
export function resetDefaultRunManager(): void {
  _default = null;
}

// ─── Re-exports for backwards compat with stub API ──────────────────────────

export function createRun(envelope: RunEnvelope): { runId: string } {
  const mgr = getDefaultRunManager();
  mgr.create(envelope);
  return { runId: envelope.run_id };
}

export function appendEvent(runId: string, event: AgentEvent): void {
  const mgr = getDefaultRunManager();
  mgr.append(runId, event.event);
}

export function finaliseRun(runId: string): RunSummary {
  const mgr = getDefaultRunManager();
  return mgr.complete(runId);
}
