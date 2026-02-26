import { describe, it, expect } from "bun:test";
import { buildSystemPrompt } from "../src/prompt-builder.js";
import type { AppSchema, AgentState, PolicyProfile } from "@agentio/protocol";

const testSchema: AppSchema = {
  name: "test-app",
  version: "1.0.0",
  entities: [
    {
      name: "Task",
      description: "A task to be completed",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "done", type: "boolean", required: true },
      ],
      storage: "state",
    },
  ],
  capabilities: [
    {
      name: "create_task",
      description: "Create a new task",
      input: [{ name: "title", type: "string", required: true }],
      output: [{ name: "id", type: "string", required: true }],
      side_effects: ["write"],
      requires_approval: false,
    },
  ],
  views: [
    {
      name: "dashboard",
      route: "/",
      description: "Main dashboard",
      data_sources: ["Task"],
      actions: ["create_task"],
      layout: [],
    },
  ],
  memory: {
    core_fields: [],
    working_ttl_ms: 300000,
    max_core_entries: 100,
  },
  governance: {
    policy_profile: "ci_safe",
    budgets: { max_time_ms: 3600000, max_tokens: 100000 },
    max_concurrent_runs: 3,
    controller_mode: "autonomous",
  },
};

const testAgentState: AgentState = {
  mode: "executing",
  current_objective: "Complete all tasks",
  working_memory_keys: [],
  recent_decisions: [],
  cumulative_budget: {
    elapsed_ms: 5000,
    tokens_used: 500,
    tool_calls: 2,
    artifacts_mb: 0,
  },
};

const testPolicy: PolicyProfile = {
  name: "ci_safe",
  rules: [
    { action: "tool.execute", scope: "*", decision: "ALLOW" },
  ],
  budgets: { max_time_ms: 3600000, max_tokens: 100000 },
};

describe("prompt-builder", () => {
  it("includes schema description", () => {
    const prompt = buildSystemPrompt({
      schema: testSchema,
      agentState: testAgentState,
      policyProfile: testPolicy,
    });
    expect(prompt).toContain("test-app v1.0.0");
    expect(prompt).toContain("create_task");
    expect(prompt).toContain("Task");
  });

  it("includes current state", () => {
    const prompt = buildSystemPrompt({
      schema: testSchema,
      agentState: testAgentState,
      policyProfile: testPolicy,
    });
    expect(prompt).toContain("Mode: executing");
    expect(prompt).toContain("Objective: Complete all tasks");
    expect(prompt).toContain("500 tokens");
  });

  it("includes policy constraints", () => {
    const prompt = buildSystemPrompt({
      schema: testSchema,
      agentState: testAgentState,
      policyProfile: testPolicy,
    });
    expect(prompt).toContain("ci_safe");
    expect(prompt).toContain("100000 tokens");
  });

  it("includes memory entries when provided", () => {
    const prompt = buildSystemPrompt({
      schema: testSchema,
      agentState: testAgentState,
      policyProfile: testPolicy,
      memoryEntries: [
        { key: "user_pref", summary: "User prefers dark mode" },
      ],
    });
    expect(prompt).toContain("Memory");
    expect(prompt).toContain("user_pref");
    expect(prompt).toContain("dark mode");
  });

  it("includes custom instructions when provided", () => {
    const prompt = buildSystemPrompt({
      schema: testSchema,
      agentState: testAgentState,
      policyProfile: testPolicy,
      customInstructions: "Always respond in Spanish.",
    });
    expect(prompt).toContain("Always respond in Spanish.");
  });

  it("includes behavioral guidelines", () => {
    const prompt = buildSystemPrompt({
      schema: testSchema,
      agentState: testAgentState,
      policyProfile: testPolicy,
    });
    expect(prompt).toContain("Guidelines");
    expect(prompt).toContain("budget");
  });
});
