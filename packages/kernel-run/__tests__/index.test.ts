import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRun, finaliseRun } from "../src/index.js";
import type { RunEnvelope } from "@agentio/protocol";

describe("kernel-run", () => {
  it("createRun returns the run id from the envelope", () => {
    const envelope: RunEnvelope = {
      run_id: "run-001",
      parent_run_id: null,
      agent_id: "test-agent@0.1.0",
      base_ref: "main",
      repo_path: "repo://test",
      objective: "test",
      policy_profile: "ci_safe",
      budgets: { max_time_ms: 60000, max_tokens: 1000 },
      timestamp: new Date().toISOString(),
    };
    const result = createRun(envelope);
    assert.equal(result.runId, "run-001");
  });

  it("finaliseRun returns a completed summary", () => {
    const summary = finaliseRun("run-001");
    assert.equal(summary.run_id, "run-001");
    assert.equal(summary.status, "completed");
  });
});
