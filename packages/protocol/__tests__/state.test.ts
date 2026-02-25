import { describe, it, expect } from "bun:test";
import {
  validateAgentState,
  validateSessionState,
  validateRunIndex,
  AGENT_MODES,
  INTERFACE_TYPES,
  DECISION_OUTCOMES,
  generateId,
  now,
} from "../src/index.js";
import type { AgentState, SessionState, RunIndex } from "../src/index.js";

function minimalAgentState(): AgentState {
  return {
    mode: "idle",
    current_objective: null,
    working_memory_keys: [],
    recent_decisions: [],
    cumulative_budget: {
      elapsed_ms: 0,
      tokens_used: 0,
      tool_calls: 0,
      artifacts_mb: 0,
    },
  };
}

function minimalSessionState(): SessionState {
  return {
    session_id: generateId(),
    agent_id: "test-agent",
    interface: "cli",
    started_at: now(),
    last_activity_at: now(),
    active_run_id: null,
    context: {},
  };
}

function emptyRunIndex(): RunIndex {
  return {
    version: 1,
    entries: [],
  };
}

describe("state constants", () => {
  it("AGENT_MODES has all modes", () => {
    expect(AGENT_MODES).toContain("idle");
    expect(AGENT_MODES).toContain("planning");
    expect(AGENT_MODES).toContain("executing");
    expect(AGENT_MODES).toContain("waiting");
    expect(AGENT_MODES).toContain("error");
    expect(AGENT_MODES.length).toBe(5);
  });

  it("INTERFACE_TYPES has all types", () => {
    expect(INTERFACE_TYPES).toContain("cli");
    expect(INTERFACE_TYPES).toContain("chat");
    expect(INTERFACE_TYPES).toContain("web");
    expect(INTERFACE_TYPES).toContain("api");
    expect(INTERFACE_TYPES.length).toBe(4);
  });

  it("DECISION_OUTCOMES has all outcomes", () => {
    expect(DECISION_OUTCOMES).toContain("success");
    expect(DECISION_OUTCOMES).toContain("failure");
    expect(DECISION_OUTCOMES).toContain("pending");
  });
});

describe("validateAgentState", () => {
  it("passes for valid agent state", () => {
    const result = validateAgentState(minimalAgentState());
    expect(result.valid).toBe(true);
  });

  it("fails for null", () => {
    const result = validateAgentState(null);
    expect(result.valid).toBe(false);
  });

  it("fails for invalid mode", () => {
    const state = { ...minimalAgentState(), mode: "running" };
    const result = validateAgentState(state);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("mode"))).toBe(true);
    }
  });

  it("accepts non-null current_objective", () => {
    const state = { ...minimalAgentState(), current_objective: "run tests" };
    const result = validateAgentState(state);
    expect(result.valid).toBe(true);
  });

  it("fails for missing cumulative_budget fields", () => {
    const state = minimalAgentState();
    (state.cumulative_budget as Record<string, unknown>).elapsed_ms = "not-number";
    const result = validateAgentState(state);
    expect(result.valid).toBe(false);
  });

  it("fails when working_memory_keys is not an array", () => {
    const state = minimalAgentState();
    (state as Record<string, unknown>).working_memory_keys = "not-array";
    const result = validateAgentState(state);
    expect(result.valid).toBe(false);
  });
});

describe("validateSessionState", () => {
  it("passes for valid session state", () => {
    const result = validateSessionState(minimalSessionState());
    expect(result.valid).toBe(true);
  });

  it("fails for null", () => {
    const result = validateSessionState(null);
    expect(result.valid).toBe(false);
  });

  it("fails for empty session_id", () => {
    const state = { ...minimalSessionState(), session_id: "" };
    const result = validateSessionState(state);
    expect(result.valid).toBe(false);
  });

  it("fails for invalid interface type", () => {
    const state = { ...minimalSessionState(), interface: "graphql" as "cli" };
    const result = validateSessionState(state);
    expect(result.valid).toBe(false);
  });

  it("accepts all valid interface types", () => {
    for (const iface of INTERFACE_TYPES) {
      const state = { ...minimalSessionState(), interface: iface };
      const result = validateSessionState(state);
      expect(result.valid).toBe(true);
    }
  });

  it("accepts non-null active_run_id", () => {
    const state = { ...minimalSessionState(), active_run_id: "run-123" };
    const result = validateSessionState(state);
    expect(result.valid).toBe(true);
  });

  it("fails when context is not an object", () => {
    const state = minimalSessionState();
    (state as Record<string, unknown>).context = "bad";
    const result = validateSessionState(state);
    expect(result.valid).toBe(false);
  });
});

describe("validateRunIndex", () => {
  it("passes for empty run index", () => {
    const result = validateRunIndex(emptyRunIndex());
    expect(result.valid).toBe(true);
  });

  it("passes with valid entries", () => {
    const index: RunIndex = {
      version: 1,
      entries: [
        {
          run_id: "run-1",
          agent_id: "agent-1",
          objective: "test",
          status: "completed",
          started_at: now(),
          finished_at: now(),
        },
      ],
    };
    const result = validateRunIndex(index);
    expect(result.valid).toBe(true);
  });

  it("fails for null", () => {
    const result = validateRunIndex(null);
    expect(result.valid).toBe(false);
  });

  it("fails for missing version", () => {
    const result = validateRunIndex({ entries: [] });
    expect(result.valid).toBe(false);
  });

  it("fails for entry with empty run_id", () => {
    const index: RunIndex = {
      version: 1,
      entries: [
        {
          run_id: "",
          agent_id: "agent-1",
          objective: "test",
          status: "completed",
          started_at: null,
          finished_at: null,
        },
      ],
    };
    const result = validateRunIndex(index);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("run_id"))).toBe(true);
    }
  });
});
