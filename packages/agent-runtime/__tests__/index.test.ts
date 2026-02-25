import { describe, it, expect } from "bun:test";
import { createAgent, startRun } from "../src/index.js";
import type { RunEnvelope, PolicyProfile } from "@agentio/protocol";

describe("agent-runtime", () => {
  it("createAgent returns an agent id", () => {
    const config = {
      policyProfile: {
        name: "test",
        rules: [],
        budgets: { max_time_ms: 60000, max_tokens: 1000 },
      } as PolicyProfile,
      mcpServers: [],
      maxConcurrentRuns: 1,
    };
    const result = createAgent(config);
    expect(result.agentId).toBeTruthy();
  });

  it("startRun returns the run id", async () => {
    const envelope: RunEnvelope = {
      run_id: "run-agent-001",
      parent_run_id: null,
      agent_id: "test-agent@0.1.0",
      base_ref: "main",
      repo_path: "repo://test",
      objective: "test",
      policy_profile: "ci_safe",
      budgets: { max_time_ms: 60000, max_tokens: 1000 },
      timestamp: new Date().toISOString(),
    };
    const result = await startRun("agent-placeholder", envelope);
    expect(result.runId).toBe("run-agent-001");
  });
});
