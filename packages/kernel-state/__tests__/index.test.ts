import { describe, it, expect } from "bun:test";
import {
  validateControlState,
  validateAgentState,
  validateSessionState,
  validateRunIndex,
} from "@agentio/protocol";
import type { RunState } from "@agentio/kernel-run";
import type { RunEnvelope } from "@agentio/protocol";
import {
  buildControlState,
  emptyControlState,
  buildAgentState,
  emptyAgentState,
  buildSessionState,
  buildRunIndex,
  emptyRunIndex,
} from "../src/index.js";

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

// ─── Agent State ────────────────────────────────────────────────────────────

describe("kernel-state: buildAgentState", () => {
  it("defaults to idle with empty budgets", () => {
    const state = buildAgentState();
    expect(state.mode).toBe("idle");
    expect(state.current_objective).toBeNull();
    expect(state.working_memory_keys).toEqual([]);
    expect(state.recent_decisions).toEqual([]);
    expect(state.cumulative_budget.elapsed_ms).toBe(0);
    expect(state.cumulative_budget.tokens_used).toBe(0);
    expect(validateAgentState(state).valid).toBe(true);
  });

  it("accepts custom mode and objective", () => {
    const state = buildAgentState({
      mode: "executing",
      currentObjective: "run tests",
    });
    expect(state.mode).toBe("executing");
    expect(state.current_objective).toBe("run tests");
    expect(validateAgentState(state).valid).toBe(true);
  });

  it("accepts partial budget overrides", () => {
    const state = buildAgentState({
      cumulativeBudget: { elapsed_ms: 5000, tokens_used: 100 },
    });
    expect(state.cumulative_budget.elapsed_ms).toBe(5000);
    expect(state.cumulative_budget.tokens_used).toBe(100);
    expect(state.cumulative_budget.tool_calls).toBe(0);
    expect(state.cumulative_budget.artifacts_mb).toBe(0);
    expect(validateAgentState(state).valid).toBe(true);
  });

  it("accepts working memory keys and decisions", () => {
    const state = buildAgentState({
      workingMemoryKeys: ["task-plan.json", "context.json"],
      recentDecisions: [
        {
          timestamp: new Date().toISOString(),
          action: "execute_run",
          reasoning: "tests needed",
          outcome: "success",
        },
      ],
    });
    expect(state.working_memory_keys.length).toBe(2);
    expect(state.recent_decisions.length).toBe(1);
    expect(validateAgentState(state).valid).toBe(true);
  });
});

describe("kernel-state: emptyAgentState", () => {
  it("returns a valid empty agent state", () => {
    const state = emptyAgentState();
    expect(state.mode).toBe("idle");
    expect(validateAgentState(state).valid).toBe(true);
  });
});

// ─── Session State ──────────────────────────────────────────────────────────

describe("kernel-state: buildSessionState", () => {
  it("builds a valid session with defaults", () => {
    const state = buildSessionState({ agentId: "agent-1" });
    expect(state.agent_id).toBe("agent-1");
    expect(state.interface).toBe("cli");
    expect(state.active_run_id).toBeNull();
    expect(state.context).toEqual({});
    expect(state.session_id.length).toBe(36);
    expect(validateSessionState(state).valid).toBe(true);
  });

  it("accepts custom interface and session id", () => {
    const state = buildSessionState({
      agentId: "agent-2",
      interfaceType: "web",
      sessionId: "custom-session-id",
    });
    expect(state.interface).toBe("web");
    expect(state.session_id).toBe("custom-session-id");
    expect(validateSessionState(state).valid).toBe(true);
  });

  it("sets timestamps to now", () => {
    const before = new Date().toISOString();
    const state = buildSessionState({ agentId: "agent-3" });
    const after = new Date().toISOString();
    expect(state.started_at >= before).toBe(true);
    expect(state.started_at <= after).toBe(true);
    expect(state.last_activity_at).toBe(state.started_at);
  });

  it("accepts context", () => {
    const state = buildSessionState({
      agentId: "agent-4",
      context: { theme: "dark", repo: "agentio" },
    });
    expect(state.context).toEqual({ theme: "dark", repo: "agentio" });
    expect(validateSessionState(state).valid).toBe(true);
  });
});

// ─── Run Index ──────────────────────────────────────────────────────────────

describe("kernel-state: buildRunIndex", () => {
  it("builds index from run states", () => {
    const runs: RunState[] = [
      makeRunState({ status: "completed" }),
      makeRunState({ status: "running" }),
    ];
    const index = buildRunIndex(runs);
    expect(index.version).toBe(1);
    expect(index.entries.length).toBe(2);
    expect(index.entries[0].status).toBe("completed");
    expect(index.entries[1].status).toBe("running");
    expect(validateRunIndex(index).valid).toBe(true);
  });

  it("maps envelope fields to index entries", () => {
    const run = makeRunState({ status: "completed" });
    const index = buildRunIndex([run]);
    expect(index.entries[0].run_id).toBe(run.envelope.run_id);
    expect(index.entries[0].agent_id).toBe(run.envelope.agent_id);
    expect(index.entries[0].objective).toBe(run.envelope.objective);
  });

  it("empty input produces valid empty index", () => {
    const index = buildRunIndex([]);
    expect(index.entries.length).toBe(0);
    expect(validateRunIndex(index).valid).toBe(true);
  });
});

describe("kernel-state: emptyRunIndex", () => {
  it("returns a valid empty run index", () => {
    const index = emptyRunIndex();
    expect(index.version).toBe(1);
    expect(index.entries).toEqual([]);
    expect(validateRunIndex(index).valid).toBe(true);
  });
});
