/**
 * @agentio/kernel-state — Control state aggregation
 *
 * Aggregates RunState[], artifact count, and policy violations
 * into a ControlState snapshot for the control metalayer.
 *
 * Pure logic — no I/O.
 */

import type { ControlState } from "@agentio/protocol";
import type { RunState } from "@agentio/kernel-run";

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
