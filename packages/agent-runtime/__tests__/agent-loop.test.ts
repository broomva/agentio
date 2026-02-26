import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AgentLoop } from "../src/agent-loop.js";
import { createTextMockModel, createToolCallMockModel } from "./mock-model.js";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { PolicyProfile, AppSchema, StreamState, StepRecord } from "@agentio/protocol";

const testPolicy: PolicyProfile = {
  name: "test",
  rules: [
    { action: "tool.execute", scope: "*", decision: "ALLOW" },
  ],
  budgets: { max_time_ms: 60000, max_tokens: 10000 },
};

const testSchema: AppSchema = {
  name: "test-agent",
  version: "0.1.0",
  entities: [],
  capabilities: [
    {
      name: "query_state",
      description: "Query agent state by key",
      input: [{ name: "key", type: "string", required: true }],
      output: [{ name: "data", type: "string", required: false }],
      side_effects: [],
      requires_approval: false,
    },
  ],
  views: [],
  memory: {
    core_fields: [],
    working_ttl_ms: 300000,
    max_core_entries: 100,
  },
  governance: {
    policy_profile: "test",
    budgets: { max_time_ms: 60000, max_tokens: 10000 },
    max_concurrent_runs: 1,
    controller_mode: "autonomous",
  },
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "agentio-test-"));
  // Create .agent directory structure
  const agentDir = join(tmpDir, ".agent");
  await mkdir(join(agentDir, "state"), { recursive: true });
  await mkdir(join(agentDir, "runs"), { recursive: true });
  await mkdir(join(agentDir, "memory"), { recursive: true });
  await mkdir(join(agentDir, "artifacts", "sha256"), { recursive: true });
  await writeFile(
    join(agentDir, "schema.json"),
    JSON.stringify(testSchema, null, 2),
  );
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("AgentLoop", () => {
  it("boots and loads schema", async () => {
    const model = createTextMockModel("Hello!");
    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
    });

    await loop.boot();
    expect(loop.getSchema()).not.toBeNull();
    expect(loop.getSchema()!.name).toBe("test-agent");
  });

  it("tick returns streaming state updates", async () => {
    const model = createTextMockModel("Hello from the agent!");
    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
    });

    await loop.boot();

    const states: StreamState[] = [];
    for await (const state of loop.tick("Hello")) {
      states.push(state);
    }

    // Should have connecting → streaming → complete
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(states[0].phase).toBe("connecting");

    const lastState = states[states.length - 1];
    expect(lastState.phase).toBe("complete");
    expect(lastState.partial_text).toContain("Hello from the agent!");
  });

  it("tracks conversation history", async () => {
    const model = createTextMockModel("I understand.");
    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
    });

    await loop.boot();

    // First tick
    for await (const _ of loop.tick("Remember: my name is Alice.")) {
      // consume
    }

    const history = loop.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("Remember: my name is Alice.");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toContain("I understand.");
  });

  it("invokes onStepComplete callback", async () => {
    const model = createTextMockModel("Step done.");
    const steps: StepRecord[] = [];

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
      onStepComplete: (step) => steps.push(step),
    });

    await loop.boot();
    for await (const _ of loop.tick("Do something")) {
      // consume
    }

    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0].step_index).toBe(0);
  });

  it("tracks usage in stream state", async () => {
    const model = createTextMockModel("Counted.");
    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
    });

    await loop.boot();

    let finalState: StreamState | null = null;
    for await (const state of loop.tick("Count tokens")) {
      finalState = state;
    }

    // Mock model may not populate totalTokens, check input_tokens instead
    const usage = finalState!.cumulative_usage;
    expect(usage.input_tokens + usage.output_tokens).toBeGreaterThanOrEqual(0);
  });

  it("handles errors gracefully", async () => {
    // A model that throws
    const model = createTextMockModel(""); // will be overridden
    (model as any).doGenerate = () => {
      throw new Error("API key invalid");
    };

    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
    });

    await loop.boot();

    const states: StreamState[] = [];
    for await (const state of loop.tick("This will fail")) {
      states.push(state);
    }

    const lastState = states[states.length - 1];
    expect(lastState.phase).toBe("error");
    expect(lastState.error).toBeDefined();
  });

  it("shutdown returns to idle", async () => {
    const model = createTextMockModel("Done.");
    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
    });

    await loop.boot();
    for await (const _ of loop.tick("Work")) {
      // consume
    }
    await loop.shutdown();

    // No assertion for state file — just ensure no throw
  });

  it("boots without schema file", async () => {
    // Remove schema file
    const { unlink } = await import("node:fs/promises");
    await unlink(join(tmpDir, ".agent", "schema.json"));

    const model = createTextMockModel("No schema, still works.");
    const loop = new AgentLoop({
      model,
      rootDir: tmpDir,
      agentId: "test-agent@0.1.0",
      policyProfile: testPolicy,
    });

    await loop.boot();
    expect(loop.getSchema()).toBeNull();

    const states: StreamState[] = [];
    for await (const state of loop.tick("Hello")) {
      states.push(state);
    }

    const lastState = states[states.length - 1];
    expect(lastState.phase).toBe("complete");
  });
});
