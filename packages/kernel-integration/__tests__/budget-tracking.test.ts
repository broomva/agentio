import { describe, it, expect, beforeEach } from "bun:test";
import { KernelHarness, createTestProfile } from "../src/index.js";
import { checkBudget } from "@agentio/kernel-policy";

describe("budget-tracking: run counters feed into checkBudget", () => {
  let harness: KernelHarness;

  beforeEach(() => {
    harness = new KernelHarness({
      profile: createTestProfile({
        budgets: { max_time_ms: 60_000, max_tokens: 10_000, max_tool_calls: 5, max_artifacts_mb: 1 },
      }),
    });
  });

  it("tool_calls from RunManager feed into checkBudget", () => {
    const run = harness.createRun({ agent_id: "agent-1", objective: "budget test" });

    // Within budget
    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);
    expect(harness.checkBudget(run.envelope.run_id).within_budget).toBe(true);

    // Record more tool calls to exceed limit of 5
    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);

    const result = harness.checkBudget(run.envelope.run_id);
    expect(result.within_budget).toBe(false);
    expect(result.violations.some((v) => v.includes("Tool call budget exceeded"))).toBe(true);
  });

  it("artifact size from store feeds into budget check", async () => {
    const tinyProfile = createTestProfile({
      budgets: { max_time_ms: 60_000, max_tokens: 10_000, max_tool_calls: 100, max_artifacts_mb: 0 },
    });
    const tinyHarness = new KernelHarness({ profile: tinyProfile });
    const run = tinyHarness.createRun({ agent_id: "agent-1", objective: "artifact budget" });

    // Store a small artifact (just a few bytes, but budget is 0 MB)
    await tinyHarness.storeArtifact("x".repeat(1024), "text/plain", run.envelope.run_id);
    tinyHarness.recordArtifactCreated(run.envelope.run_id);

    const result = tinyHarness.checkBudget(run.envelope.run_id);
    expect(result.within_budget).toBe(false);
    expect(result.violations.some((v) => v.includes("Artifact budget exceeded"))).toBe(true);
  });

  it("within-budget run completes successfully", async () => {
    const run = harness.createRun({ agent_id: "agent-1", objective: "good run" });

    harness.recordToolCall(run.envelope.run_id);
    harness.recordToolCall(run.envelope.run_id);
    await harness.storeArtifact("small", "text/plain", run.envelope.run_id);
    harness.recordArtifactCreated(run.envelope.run_id);

    const budget = harness.checkBudget(run.envelope.run_id);
    expect(budget.within_budget).toBe(true);
    expect(budget.violations).toHaveLength(0);

    const summary = harness.completeRun(run.envelope.run_id);
    expect(summary.status).toBe("completed");
    expect(summary.tool_calls).toBe(2);
    expect(summary.artifacts_created).toBe(1);
  });

  it("raw checkBudget validates all dimensions", () => {
    const budgets = { max_time_ms: 1000, max_tokens: 100, max_tool_calls: 5, max_artifacts_mb: 1 };

    // All within budget
    expect(checkBudget(budgets, { elapsed_ms: 500, tokens_used: 50, tool_calls: 3, artifacts_mb: 0.5 }).within_budget).toBe(true);

    // Time exceeded
    expect(checkBudget(budgets, { elapsed_ms: 2000, tokens_used: 50, tool_calls: 3, artifacts_mb: 0.5 }).violations).toHaveLength(1);

    // Multiple exceeded
    const result = checkBudget(budgets, { elapsed_ms: 2000, tokens_used: 200, tool_calls: 10, artifacts_mb: 5 });
    expect(result.within_budget).toBe(false);
    expect(result.violations).toHaveLength(4);
  });
});
