import { describe, it, expect, beforeEach } from "bun:test";
import { createError } from "@agentio/protocol";
import { KernelHarness, createTestProfile } from "../src/index.js";

describe("kernel-flow: full lifecycle", () => {
  let harness: KernelHarness;

  beforeEach(() => {
    harness = new KernelHarness({ profile: createTestProfile() });
  });

  it("happy path: create → policy → tool calls → artifact → complete", async () => {
    const run = harness.createRun({ agent_id: "test-agent", objective: "build feature" });
    expect(run.status).toBe("running");

    // Policy check — file.read is allowed
    const policyResult = harness.evaluatePolicy("file.read", "src/index.ts");
    expect(policyResult.decision).toBe("ALLOW");

    // Record tool calls
    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);

    // Store an artifact
    const handle = await harness.storeArtifact("console.log('hello')", "text/typescript", run.envelope.run_id);
    harness.recordArtifactCreated(run.envelope.run_id);
    expect(handle).toMatch(/^artifact:\/\/sha256\//);

    // Budget check
    const budget = harness.checkBudget(run.envelope.run_id);
    expect(budget.within_budget).toBe(true);

    // Complete
    const summary = harness.completeRun(run.envelope.run_id);
    expect(summary.status).toBe("completed");
    expect(summary.tool_calls).toBe(2);
    expect(summary.artifacts_created).toBe(1);
    expect(summary.errors).toBe(0);

    // Validate all events
    const events = harness.runManager.events(run.envelope.run_id);
    expect(events.length).toBeGreaterThanOrEqual(4); // started + 2 tool + artifact + completed
    expect(events[0].event).toBe("run.started");
    expect(events[events.length - 1].event).toBe("run.completed");
  });

  it("policy denial: DENY decision fails the run", () => {
    const run = harness.createRun({ agent_id: "test-agent", objective: "log secret" });

    const policyResult = harness.evaluatePolicy("secret.log", "credentials");
    expect(policyResult.decision).toBe("DENY");

    const summary = harness.failRun(
      run.envelope.run_id,
      createError("POLICY_DENIED", "Action denied by policy", false),
    );
    expect(summary.status).toBe("failed");
    expect(summary.errors).toBe(1);
    expect(harness.totalPolicyViolations).toBe(1);
  });

  it("budget exceeded: tight tool_calls budget fails run", () => {
    const tightProfile = createTestProfile({
      budgets: { max_time_ms: 60_000, max_tokens: 10_000, max_tool_calls: 2, max_artifacts_mb: 10 },
    });
    const tightHarness = new KernelHarness({ profile: tightProfile });
    const run = tightHarness.createRun({ agent_id: "test-agent", objective: "over budget" });

    // Make 3 tool calls, exceeding the budget of 2
    tightHarness.recordToolCall(run.envelope.run_id);
    tightHarness.recordToolCall(run.envelope.run_id);
    tightHarness.recordToolCall(run.envelope.run_id);

    const budget = tightHarness.checkBudget(run.envelope.run_id);
    expect(budget.within_budget).toBe(false);
    expect(budget.violations.length).toBeGreaterThan(0);
    expect(budget.violations[0]).toContain("Tool call budget exceeded");

    const summary = tightHarness.failRun(
      run.envelope.run_id,
      createError("BUDGET_EXCEEDED", "Tool call budget exceeded", false),
    );
    expect(summary.status).toBe("failed");
  });

  it("artifact deduplication across runs", async () => {
    const run1 = harness.createRun({ agent_id: "agent-1", objective: "run 1" });
    const run2 = harness.createRun({ agent_id: "agent-2", objective: "run 2" });

    const content = "shared artifact content";
    const handle1 = await harness.storeArtifact(content, "text/plain", run1.envelope.run_id);
    const handle2 = await harness.storeArtifact(content, "text/plain", run2.envelope.run_id);

    // Same content → same handle (content-addressed)
    expect(handle1).toBe(handle2);

    // Retrieve should return same data
    const data = await harness.artifactStore.retrieveString(handle1);
    expect(data).toBe(content);
  });

  it("multiple concurrent runs on same RunManager", () => {
    const run1 = harness.createRun({ agent_id: "agent-1", objective: "task 1" });
    const run2 = harness.createRun({ agent_id: "agent-2", objective: "task 2" });
    const run3 = harness.createRun({ agent_id: "agent-3", objective: "task 3" });

    // All running
    expect(harness.runManager.get(run1.envelope.run_id)?.status).toBe("running");
    expect(harness.runManager.get(run2.envelope.run_id)?.status).toBe("running");
    expect(harness.runManager.get(run3.envelope.run_id)?.status).toBe("running");

    // Complete one, fail another
    harness.completeRun(run1.envelope.run_id);
    harness.failRun(run2.envelope.run_id, createError("TEST", "test error", false));

    // Verify independent state
    expect(harness.runManager.get(run1.envelope.run_id)?.status).toBe("completed");
    expect(harness.runManager.get(run2.envelope.run_id)?.status).toBe("failed");
    expect(harness.runManager.get(run3.envelope.run_id)?.status).toBe("running");

    const allRuns = harness.runManager.list();
    expect(allRuns.length).toBe(3);
  });
});
