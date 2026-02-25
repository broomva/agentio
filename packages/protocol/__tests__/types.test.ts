import { describe, it, expect } from "bun:test";
import {
  createRunEnvelope,
  createEvent,
  createError,
  artifactHandle,
  validateRunEnvelope,
  validateEvent,
  isArtifactHandle,
  generateId,
  now,
  ARTIFACT_SCHEME,
  SECRET_SCHEME,
  REPO_SCHEME,
  EVENT_TYPES,
  RUN_STATUSES,
} from "../src/index.js";
import type {
  RunEnvelope,
  BaseEvent,
  ArtifactHandle,
  StructuredError,
  PolicyDecision,
  RunStatus,
} from "../src/index.js";

describe("constants", () => {
  it("URI schemes are defined", () => {
    expect(ARTIFACT_SCHEME).toBe("artifact://");
    expect(SECRET_SCHEME).toBe("secret://");
    expect(REPO_SCHEME).toBe("repo://");
  });

  it("EVENT_TYPES contains all event types", () => {
    expect(EVENT_TYPES).toContain("run.started");
    expect(EVENT_TYPES).toContain("tool.called");
    expect(EVENT_TYPES).toContain("policy.decision");
    expect(EVENT_TYPES.length).toBe(9);
  });

  it("RUN_STATUSES contains all statuses", () => {
    expect(RUN_STATUSES).toContain("pending");
    expect(RUN_STATUSES).toContain("running");
    expect(RUN_STATUSES).toContain("completed");
    expect(RUN_STATUSES).toContain("failed");
    expect(RUN_STATUSES).toContain("cancelled");
  });
});

describe("generateId", () => {
  it("returns a UUID string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(36);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("now", () => {
  it("returns an ISO timestamp", () => {
    const ts = now();
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});

describe("createRunEnvelope", () => {
  it("creates envelope with defaults", () => {
    const envelope = createRunEnvelope({
      agent_id: "test-agent@0.1.0",
      objective: "run tests",
    });
    expect(envelope.agent_id).toBe("test-agent@0.1.0");
    expect(envelope.objective).toBe("run tests");
    expect(envelope.run_id.length).toBe(36);
    expect(envelope.parent_run_id).toBeNull();
    expect(envelope.base_ref).toBe("main");
    expect(envelope.policy_profile).toBe("ci_safe");
    expect(envelope.budgets.max_time_ms).toBe(3_600_000);
    expect(envelope.budgets.max_tokens).toBe(100_000);
  });

  it("allows overriding defaults", () => {
    const envelope = createRunEnvelope({
      agent_id: "agent",
      objective: "deploy",
      run_id: "custom-id",
      base_ref: "develop",
      policy_profile: "release_safe",
      budgets: { max_time_ms: 1000, max_tokens: 500 },
    });
    expect(envelope.run_id).toBe("custom-id");
    expect(envelope.base_ref).toBe("develop");
    expect(envelope.policy_profile).toBe("release_safe");
    expect(envelope.budgets.max_tokens).toBe(500);
  });
});

describe("createEvent", () => {
  it("creates an event with correct fields", () => {
    const event = createEvent("run-1", "agent-1", 0, "run.started");
    expect(event.run_id).toBe("run-1");
    expect(event.agent_id).toBe("agent-1");
    expect(event.step_id).toBe(0);
    expect(event.event).toBe("run.started");
    expect(typeof event.timestamp).toBe("string");
  });
});

describe("createError", () => {
  it("creates a structured error", () => {
    const err = createError("BUILD_FAILED", "tsc exited with code 1", true);
    expect(err.code).toBe("BUILD_FAILED");
    expect(err.message).toBe("tsc exited with code 1");
    expect(err.recoverable).toBe(true);
    expect(err.details).toBeUndefined();
  });

  it("includes details when provided", () => {
    const err = createError("TIMEOUT", "exceeded budget", false, { elapsed_ms: 5000 });
    expect(err.details).toEqual({ elapsed_ms: 5000 });
  });
});

describe("artifactHandle", () => {
  it("builds correct URI", () => {
    const handle = artifactHandle("abcd1234");
    expect(handle).toBe("artifact://sha256/abcd1234");
  });
});

describe("isArtifactHandle", () => {
  it("returns true for valid handles", () => {
    expect(isArtifactHandle("artifact://sha256/abc")).toBe(true);
    expect(isArtifactHandle("artifact://foo")).toBe(true);
  });

  it("returns false for non-handles", () => {
    expect(isArtifactHandle("file:///tmp/test")).toBe(false);
    expect(isArtifactHandle("secret://db-pass")).toBe(false);
  });
});

describe("validateRunEnvelope", () => {
  it("passes for valid envelope", () => {
    const envelope = createRunEnvelope({
      agent_id: "test",
      objective: "test",
    });
    const result = validateRunEnvelope(envelope);
    expect(result.valid).toBe(true);
  });

  it("fails for null", () => {
    const result = validateRunEnvelope(null);
    expect(result.valid).toBe(false);
  });

  it("fails for missing fields", () => {
    const result = validateRunEnvelope({ run_id: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("run_id"))).toBe(true);
    }
  });

  it("fails for bad budgets", () => {
    const result = validateRunEnvelope({
      run_id: "x",
      agent_id: "a",
      objective: "o",
      timestamp: "t",
      policy_profile: "p",
      budgets: { max_time_ms: "not a number" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("validateEvent", () => {
  it("passes for valid event", () => {
    const event = createEvent("run-1", "agent-1", 0, "run.started");
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it("fails for invalid event type", () => {
    const result = validateEvent({
      run_id: "r",
      agent_id: "a",
      step_id: 0,
      event: "invalid.type",
      timestamp: "t",
    });
    expect(result.valid).toBe(false);
  });

  it("fails for negative step_id", () => {
    const result = validateEvent({
      run_id: "r",
      agent_id: "a",
      step_id: -1,
      event: "run.started",
      timestamp: "t",
    });
    expect(result.valid).toBe(false);
  });
});
