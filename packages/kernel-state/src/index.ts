/**
 * @agentio/kernel-state — State aggregation
 *
 * Aggregates RunState[], artifact count, and policy violations
 * into ControlState, AgentState, SessionState, and RunIndex snapshots.
 *
 * Pure logic — no I/O.
 */

import type {
  ControlState,
  AgentState,
  SessionState,
  RunIndex,
  RunIndexEntry,
  BudgetUsage,
  Decision,
} from "@agentio/protocol";
import { generateId, now } from "@agentio/protocol";
import type { RunState } from "@agentio/kernel-run";

// ─── Control State ──────────────────────────────────────────────────────────

export interface StateInput {
  runs: RunState[];
  artifactCount: number;
  policyViolations: number;
  controllerMode?: ControlState["controller_mode"];
  lastAuditAt?: string | null;
  lastEntropyReviewAt?: string | null;
}

/** Build a ControlState snapshot from kernel subsystem data. */
export function buildControlState(input: StateInput): ControlState {
  const activeRuns = input.runs.filter(
    (r) => r.status === "pending" || r.status === "running",
  ).length;
  const completedRuns = input.runs.filter(
    (r) => r.status === "completed" || r.status === "failed" || r.status === "cancelled",
  ).length;

  return {
    version: 1,
    controller_mode: input.controllerMode ?? "autonomous",
    last_audit_at: input.lastAuditAt ?? null,
    last_entropy_review_at: input.lastEntropyReviewAt ?? null,
    active_runs: activeRuns,
    completed_runs: completedRuns,
    artifact_count: input.artifactCount,
    policy_violations: input.policyViolations,
  };
}

/** Create an empty ControlState with sensible defaults. */
export function emptyControlState(): ControlState {
  return {
    version: 1,
    controller_mode: "autonomous",
    last_audit_at: null,
    last_entropy_review_at: null,
    active_runs: 0,
    completed_runs: 0,
    artifact_count: 0,
    policy_violations: 0,
  };
}

// ─── Agent State ────────────────────────────────────────────────────────────

export interface AgentStateInput {
  mode?: AgentState["mode"];
  currentObjective?: string | null;
  workingMemoryKeys?: string[];
  recentDecisions?: Decision[];
  cumulativeBudget?: Partial<BudgetUsage>;
}

/** Build an AgentState from input. */
export function buildAgentState(input: AgentStateInput = {}): AgentState {
  return {
    mode: input.mode ?? "idle",
    current_objective: input.currentObjective ?? null,
    working_memory_keys: input.workingMemoryKeys ?? [],
    recent_decisions: input.recentDecisions ?? [],
    cumulative_budget: {
      elapsed_ms: input.cumulativeBudget?.elapsed_ms ?? 0,
      tokens_used: input.cumulativeBudget?.tokens_used ?? 0,
      tool_calls: input.cumulativeBudget?.tool_calls ?? 0,
      artifacts_mb: input.cumulativeBudget?.artifacts_mb ?? 0,
    },
  };
}

/** Create an empty AgentState. */
export function emptyAgentState(): AgentState {
  return buildAgentState();
}

// ─── Session State ──────────────────────────────────────────────────────────

export interface SessionInput {
  agentId: string;
  interfaceType?: SessionState["interface"];
  sessionId?: string;
  context?: Record<string, unknown>;
}

/** Build a SessionState from input. */
export function buildSessionState(input: SessionInput): SessionState {
  const ts = now();
  return {
    session_id: input.sessionId ?? generateId(),
    agent_id: input.agentId,
    interface: input.interfaceType ?? "cli",
    started_at: ts,
    last_activity_at: ts,
    active_run_id: null,
    context: input.context ?? {},
  };
}

// ─── Run Index ──────────────────────────────────────────────────────────────

/** Build a RunIndex from a list of RunStates. */
export function buildRunIndex(runs: RunState[]): RunIndex {
  const entries: RunIndexEntry[] = runs.map((r) => ({
    run_id: r.envelope.run_id,
    agent_id: r.envelope.agent_id,
    objective: r.envelope.objective,
    status: r.status,
    started_at: r.started_at,
    finished_at: r.finished_at,
  }));

  return {
    version: 1,
    entries,
  };
}

/** Create an empty RunIndex. */
export function emptyRunIndex(): RunIndex {
  return {
    version: 1,
    entries: [],
  };
}
