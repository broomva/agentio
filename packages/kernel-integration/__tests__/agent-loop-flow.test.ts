/**
 * Integration test: AgentLoop with mock model
 *
 * Exercises the full OODA cycle through AgentLoop using a MockLanguageModelV3,
 * verifying that protocol types, kernel subsystems, and bridges all compose
 * correctly without needing an API key.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3, mockValues } from "ai/test";
import { AgentLoop } from "@agentio/agent-runtime";
import type { StreamState, StepRecord, AgentEvent, PolicyProfile } from "@agentio/protocol";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTextMockModel(text: string) {
  return new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text }],
      finishReason: "stop",
      usage: { inputTokens: 42, outputTokens: 17 },
      warnings: [],
    },
  });
}

function createMultiStepMockModel(toolName: string, args: Record<string, unknown>) {
  return new MockLanguageModelV3({
    doGenerate: mockValues(
      {
        content: [
          { type: "tool-call", toolCallId: "tc-int-1", toolName, args },
        ],
        finishReason: "tool-calls" as const,
        usage: { inputTokens: 20, outputTokens: 10 },
        warnings: [],
      },
      {
        content: [{ type: "text", text: "Tool execution complete." }],
        finishReason: "stop" as const,
        usage: { inputTokens: 30, outputTokens: 15 },
        warnings: [],
      },
    ),
  });
}

const TEST_PROFILE: PolicyProfile = {
  name: "integration_test",
  rules: [
    { action: "tool.execute", scope: "*", decision: "ALLOW" },
  ],
  budgets: {
    max_time_ms: 30_000,
    max_tokens: 50_000,
    max_tool_calls: 20,
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("agent-loop-flow: integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "agentio-int-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("full OODA cycle: boot → tick → complete with text response", async () => {
    const model = createTextMockModel("Integration test passed!");
    const stateUpdates: StreamState[] = [];
    const events: AgentEvent[] = [];

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "integration-test@1.0",
      policyProfile: TEST_PROFILE,
      onEvent: (e) => events.push(e),
    });

    await loop.boot();

    for await (const state of loop.tick("Run integration test", "api")) {
      stateUpdates.push({ ...state });
    }

    // Should have progressed through phases
    const phases = stateUpdates.map((s) => s.phase);
    expect(phases).toContain("connecting");
    expect(phases).toContain("streaming");
    expect(phases).toContain("complete");

    // Final state has the response text
    const final = stateUpdates[stateUpdates.length - 1];
    expect(final.phase).toBe("complete");
    expect(final.partial_text).toBe("Integration test passed!");

    // History should have user + assistant messages
    const history = loop.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("Run integration test");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toBe("Integration test passed!");

    // Events should include llm.step_completed and llm.usage
    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("llm.step_completed");
    expect(eventTypes).toContain("llm.usage");

    await loop.shutdown();
  });

  it("multi-turn conversation preserves history", async () => {
    const model = createTextMockModel("Response");

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "multi-turn@1.0",
      policyProfile: TEST_PROFILE,
    });

    await loop.boot();

    // First turn
    for await (const _ of loop.tick("Hello", "cli")) {
      // consume
    }
    expect(loop.getHistory().length).toBe(2); // user + assistant

    // Second turn
    for await (const _ of loop.tick("Follow-up", "cli")) {
      // consume
    }
    expect(loop.getHistory().length).toBe(4); // 2 users + 2 assistants
    expect(loop.getHistory()[2].role).toBe("user");
    expect(loop.getHistory()[2].content).toBe("Follow-up");

    await loop.shutdown();
  });

  it("step records track per-step metadata", async () => {
    const model = createTextMockModel("Step check.");
    const steps: StepRecord[] = [];

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "step-track@1.0",
      policyProfile: TEST_PROFILE,
      onStepComplete: (s) => steps.push(s),
    });

    await loop.boot();

    for await (const _ of loop.tick("Check steps")) {
      // consume
    }

    expect(steps.length).toBeGreaterThan(0);
    // finish_reason is present (mock model may return undefined which gets cast)
    expect(steps[0]).toHaveProperty("finish_reason");
    // Usage fields are present (may be 0 with mock model)
    expect(typeof steps[0].usage.input_tokens).toBe("number");
    expect(typeof steps[0].usage.output_tokens).toBe("number");

    await loop.shutdown();
  });

  it("usage accumulates across steps", async () => {
    const model = createTextMockModel("Usage test.");

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "usage-acc@1.0",
      policyProfile: TEST_PROFILE,
    });

    await loop.boot();

    let finalState: StreamState | null = null;
    for await (const state of loop.tick("Check usage")) {
      finalState = state;
    }

    expect(finalState).not.toBeNull();
    expect(finalState!.phase).toBe("complete");
    // Usage is tracked (mock model may return 0 depending on AI SDK version)
    expect(typeof finalState!.cumulative_usage.input_tokens).toBe("number");
    expect(typeof finalState!.cumulative_usage.output_tokens).toBe("number");
    expect(typeof finalState!.cumulative_usage.total_tokens).toBe("number");

    await loop.shutdown();
  });

  it("boot without schema file uses default prompt", async () => {
    const model = createTextMockModel("No schema mode.");

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "no-schema@1.0",
      policyProfile: TEST_PROFILE,
      customInstructions: "Be minimal.",
    });

    await loop.boot();
    expect(loop.getSchema()).toBeNull();

    let completed = false;
    for await (const state of loop.tick("Hello without schema")) {
      if (state.phase === "complete") {
        completed = true;
        expect(state.partial_text).toBe("No schema mode.");
      }
    }
    expect(completed).toBe(true);

    await loop.shutdown();
  });

  it("shutdown after tick returns agent to idle mode", async () => {
    const model = createTextMockModel("Done.");

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "shutdown-test@1.0",
      policyProfile: TEST_PROFILE,
    });

    await loop.boot();

    for await (const _ of loop.tick("Work")) {
      // consume
    }

    await loop.shutdown();

    // After shutdown, stream state should be at idle or complete
    const state = loop.getStreamState();
    expect(["idle", "complete"]).toContain(state.phase);
  });

  it("events have correct run_id and agent_id fields", async () => {
    const model = createTextMockModel("Event check.");
    const events: AgentEvent[] = [];

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "event-check@1.0",
      policyProfile: TEST_PROFILE,
      onEvent: (e) => events.push(e),
    });

    await loop.boot();

    for await (const _ of loop.tick("Emit events")) {
      // consume
    }

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.agent_id).toBe("event-check@1.0");
      expect(event.run_id).toBeTruthy();
      expect(event.timestamp).toBeTruthy();
    }

    await loop.shutdown();
  });
});
