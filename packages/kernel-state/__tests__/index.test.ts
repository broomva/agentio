import { describe, it, expect } from "bun:test";
import { validateControlState } from "@agentio/protocol";
import type { RunState } from "@agentio/kernel-run";
import type { RunEnvelope } from "@agentio/protocol";
import { buildControlState, emptyControlState } from "../src/index.js";

function makeRunState(overrides: Partial<RunState> & { status: RunState["status"] }): RunState {
  const envelope: RunEnvelope = {
    run_id: `run-${Math.random().toString(36).slice(2)}`,
    parent_run_id: null,
    agent_id: "test-agent",
    base_ref: "main",
    repo_path: "repo://test",
    objective: "test",
    policy_profile: "ci_safe",
    budgets: { max_time_ms: 60_000, max_tokens: 10_000 },
    timestamp: new Date().toISOString(),
  };
  return {
    envelope,
    status: overrides.status,
    step: overrides.step ?? 0,
    events: overrides.events ?? [],
    started_at: overrides.started_at ?? null,
    finished_at: overrides.finished_at ?? null,
    error: overrides.error ?? null,
    tool_calls: overrides.tool_calls ?? 0,
    artifacts_created: overrides.artifacts_created ?? 0,
    errors: overrides.errors ?? 0,
  };
}

describe("kernel-state: buildControlState", () => {
  it("empty input produces valid zero-state", () => {
    const state = buildControlState({
      runs: [],
      artifactCount: 0,
      policyViolations: 0,
    });
    expect(state.version).toBe(1);
    expect(state.active_runs).toBe(0);
    expect(state.completed_runs).toBe(0);
    expect(state.artifact_count).toBe(0);
    expect(state.policy_violations).toBe(0);
    expect(state.controller_mode).toBe("autonomous");

    const validation = validateControlState(state);
    expect(validation.valid).toBe(true);
  });

  it("counts active vs completed runs correctly", () => {
    const runs: RunState[] = [
      makeRunState({ status: "running" }),
      makeRunState({ status: "pending" }),
      makeRunState({ status: "completed" }),
      makeRunState({ status: "failed" }),
      makeRunState({ status: "cancelled" }),
    ];
    const state = buildControlState({ runs, artifactCount: 3, policyViolations: 1 });

    expect(state.active_runs).toBe(2);    // running + pending
    expect(state.completed_runs).toBe(3); // completed + failed + cancelled
    expect(state.artifact_count).toBe(3);
    expect(state.policy_violations).toBe(1);
  });

  it("passes audit metadata through", () => {
    const auditTime = new Date().toISOString();
    const entropyTime = new Date().toISOString();
    const state = buildControlState({
      runs: [],
      artifactCount: 0,
      policyViolations: 0,
      lastAuditAt: auditTime,
      lastEntropyReviewAt: entropyTime,
      controllerMode: "supervised",
    });
    expect(state.last_audit_at).toBe(auditTime);
    expect(state.last_entropy_review_at).toBe(entropyTime);
    expect(state.controller_mode).toBe("supervised");
  });

  it("output always passes validateControlState", () => {
    const state = buildControlState({
      runs: [makeRunState({ status: "running" })],
      artifactCount: 5,
      policyViolations: 2,
      controllerMode: "manual",
    });
    expect(validateControlState(state).valid).toBe(true);
  });
});

describe("kernel-state: emptyControlState", () => {
  it("returns a valid empty state", () => {
    const state = emptyControlState();
    expect(state.version).toBe(1);
    expect(state.active_runs).toBe(0);
    expect(state.completed_runs).toBe(0);
    expect(validateControlState(state).valid).toBe(true);
  });
});
