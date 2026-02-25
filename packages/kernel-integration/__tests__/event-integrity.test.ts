import { describe, it, expect, beforeEach } from "bun:test";
import { validateEvent } from "@agentio/protocol";
import { KernelHarness, createTestProfile } from "../src/index.js";

describe("event-integrity: protocol validation", () => {
  let harness: KernelHarness;

  beforeEach(() => {
    harness = new KernelHarness({ profile: createTestProfile() });
  });

  it("all emitted events pass validateEvent()", async () => {
    const run = harness.createRun({ agent_id: "test-agent", objective: "event test" });

    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);
    harness.recordArtifactCreated(run.envelope.run_id);
    harness.completeRun(run.envelope.run_id);

    const events = harness.runManager.events(run.envelope.run_id);
    expect(events.length).toBeGreaterThanOrEqual(4);

    for (const event of events) {
      const result = validateEvent(event);
      expect(result.valid).toBe(true);
    }
  });

  it("step_ids are monotonically increasing", () => {
    const run = harness.createRun({ agent_id: "test-agent", objective: "step tracking" });

    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);
    harness.completeRun(run.envelope.run_id);

    const events = harness.runManager.events(run.envelope.run_id);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].step_id).toBeGreaterThan(events[i - 1].step_id);
    }
  });

  it("all events share same run_id and agent_id", () => {
    const run = harness.createRun({ agent_id: "consistent-agent", objective: "id consistency" });

    harness.recordToolCall(run.envelope.run_id);
    harness.recordArtifactCreated(run.envelope.run_id);
    harness.completeRun(run.envelope.run_id);

    const events = harness.runManager.events(run.envelope.run_id);
    for (const event of events) {
      expect(event.run_id).toBe(run.envelope.run_id);
      expect(event.agent_id).toBe("consistent-agent");
    }
  });

  it("events from different runs have distinct run_ids", () => {
    const run1 = harness.createRun({ agent_id: "agent-a", objective: "run 1" });
    const run2 = harness.createRun({ agent_id: "agent-b", objective: "run 2" });

    harness.recordToolCall(run1.envelope.run_id);
    harness.recordToolCall(run2.envelope.run_id);
    harness.completeRun(run1.envelope.run_id);
    harness.completeRun(run2.envelope.run_id);

    const events1 = harness.runManager.events(run1.envelope.run_id);
    const events2 = harness.runManager.events(run2.envelope.run_id);

    expect(events1[0].run_id).not.toBe(events2[0].run_id);
    for (const e of events1) expect(e.agent_id).toBe("agent-a");
    for (const e of events2) expect(e.agent_id).toBe("agent-b");
  });

  it("failed run events also pass validation", () => {
    const run = harness.createRun({ agent_id: "test-agent", objective: "fail test" });
    harness.recordToolCall(run.envelope.run_id);
    harness.failRun(run.envelope.run_id, { code: "TEST_ERROR", message: "test", recoverable: false });

    const events = harness.runManager.events(run.envelope.run_id);
    for (const event of events) {
      expect(validateEvent(event).valid).toBe(true);
    }
    expect(events[events.length - 1].event).toBe("run.failed");
  });
});
