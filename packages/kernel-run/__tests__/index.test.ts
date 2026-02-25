import { describe, it, expect, beforeEach } from "bun:test";
import {
  RunManager,
  canTransition,
  resetDefaultRunManager,
  createRun,
  finaliseRun,
} from "../src/index.js";
import type { RunState } from "../src/index.js";
import { createRunEnvelope, createError } from "@agentio/protocol";
import type { AgentEvent, RunEnvelope } from "@agentio/protocol";

function makeEnvelope(overrides?: Partial<RunEnvelope>): RunEnvelope {
  return createRunEnvelope({
    agent_id: "test-agent@0.1.0",
    objective: "run tests",
    ...overrides,
  });
}

describe("canTransition", () => {
  it("allows pending → running", () => {
    expect(canTransition("pending", "running")).toBe(true);
  });

  it("allows pending → cancelled", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
  });

  it("allows running → completed", () => {
    expect(canTransition("running", "completed")).toBe(true);
  });

  it("allows running → failed", () => {
    expect(canTransition("running", "failed")).toBe(true);
  });

  it("disallows completed → running", () => {
    expect(canTransition("completed", "running")).toBe(false);
  });

  it("disallows pending → completed", () => {
    expect(canTransition("pending", "completed")).toBe(false);
  });

  it("disallows failed → anything", () => {
    expect(canTransition("failed", "running")).toBe(false);
    expect(canTransition("failed", "completed")).toBe(false);
  });
});

describe("RunManager", () => {
  let mgr: RunManager;

  beforeEach(() => {
    mgr = new RunManager();
  });

  describe("create", () => {
    it("creates a run in pending state", () => {
      const env = makeEnvelope();
      const run = mgr.create(env);
      expect(run.status).toBe("pending");
      expect(run.step).toBe(0);
      expect(run.events).toEqual([]);
      expect(run.envelope.run_id).toBe(env.run_id);
    });

    it("throws on duplicate run_id", () => {
      const env = makeEnvelope({ run_id: "dup-id" });
      mgr.create(env);
      expect(() => mgr.create(env)).toThrow("already exists");
    });
  });

  describe("get / list", () => {
    it("returns null for unknown run", () => {
      expect(mgr.get("nonexistent")).toBeNull();
    });

    it("lists all runs", () => {
      mgr.create(makeEnvelope({ run_id: "r1" }));
      mgr.create(makeEnvelope({ run_id: "r2" }));
      expect(mgr.list()).toHaveLength(2);
    });
  });

  describe("lifecycle: start → append → complete", () => {
    it("transitions through full lifecycle", () => {
      const env = makeEnvelope({ run_id: "run-1" });
      mgr.create(env);

      // Start
      const startEvent = mgr.start("run-1");
      expect(startEvent.event).toBe("run.started");
      expect(mgr.get("run-1")!.status).toBe("running");
      expect(mgr.get("run-1")!.started_at).not.toBeNull();

      // Append tool calls
      mgr.append("run-1", "tool.called");
      mgr.append("run-1", "tool.result");
      mgr.append("run-1", "artifact.created");
      expect(mgr.currentStep("run-1")).toBe(4); // 1 start + 3 appended

      // Complete
      const summary = mgr.complete("run-1");
      expect(summary.status).toBe("completed");
      expect(summary.tool_calls).toBe(1);
      expect(summary.artifacts_created).toBe(1);
      expect(summary.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("fail", () => {
    it("transitions to failed with error", () => {
      const env = makeEnvelope({ run_id: "run-fail" });
      mgr.create(env);
      mgr.start("run-fail");

      const error = createError("TIMEOUT", "exceeded budget", false);
      const summary = mgr.fail("run-fail", error);

      expect(summary.status).toBe("failed");
      expect(summary.errors).toBe(1);
      expect(mgr.get("run-fail")!.error).toBe(error);
    });
  });

  describe("cancel", () => {
    it("cancels a pending run", () => {
      const env = makeEnvelope({ run_id: "run-cancel" });
      mgr.create(env);
      const summary = mgr.cancel("run-cancel");
      expect(summary.status).toBe("cancelled");
    });

    it("cancels a running run", () => {
      const env = makeEnvelope({ run_id: "run-cancel-2" });
      mgr.create(env);
      mgr.start("run-cancel-2");
      const summary = mgr.cancel("run-cancel-2");
      expect(summary.status).toBe("cancelled");
    });
  });

  describe("invalid transitions", () => {
    it("throws when starting a completed run", () => {
      const env = makeEnvelope({ run_id: "done" });
      mgr.create(env);
      mgr.start("done");
      mgr.complete("done");
      expect(() => mgr.start("done")).toThrow("Invalid transition");
    });

    it("throws when appending to a pending run", () => {
      const env = makeEnvelope({ run_id: "pend" });
      mgr.create(env);
      expect(() => mgr.append("pend", "tool.called")).toThrow(
        'Cannot append events to run in "pending" state',
      );
    });

    it("throws for unknown run", () => {
      expect(() => mgr.start("ghost")).toThrow("not found");
    });
  });

  describe("events", () => {
    it("returns a copy of the event log", () => {
      const env = makeEnvelope({ run_id: "ev" });
      mgr.create(env);
      mgr.start("ev");
      mgr.append("ev", "tool.called");

      const events = mgr.events("ev");
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe("run.started");
      expect(events[1].event).toBe("tool.called");

      // Verify it's a copy
      events.pop();
      expect(mgr.events("ev")).toHaveLength(2);
    });
  });

  describe("listeners", () => {
    it("notifies listeners on events", () => {
      const received: AgentEvent[] = [];
      mgr.on((event) => received.push(event));

      const env = makeEnvelope({ run_id: "listen" });
      mgr.create(env);
      mgr.start("listen");
      mgr.append("listen", "tool.called");

      expect(received).toHaveLength(2);
      expect(received[0].event).toBe("run.started");
      expect(received[1].event).toBe("tool.called");
    });

    it("supports unsubscribe", () => {
      const received: AgentEvent[] = [];
      const unsub = mgr.on((event) => received.push(event));

      const env = makeEnvelope({ run_id: "unsub" });
      mgr.create(env);
      mgr.start("unsub");
      unsub();
      mgr.append("unsub", "tool.called");

      expect(received).toHaveLength(1); // only run.started
    });
  });
});

describe("backwards-compat functions", () => {
  beforeEach(() => {
    resetDefaultRunManager();
  });

  it("createRun + finaliseRun work", () => {
    const env = makeEnvelope({ run_id: "compat" });
    const { runId } = createRun(env);
    expect(runId).toBe("compat");
  });
});
