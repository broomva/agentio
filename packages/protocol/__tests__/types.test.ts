import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  RunEnvelope,
  BaseEvent,
  ArtifactHandle,
  PolicyRule,
  ToolContract,
  StructuredError,
} from "../src/index.js";
import { ARTIFACT_SCHEME, SECRET_SCHEME, REPO_SCHEME } from "../src/index.js";

describe("protocol types", () => {
  it("RunEnvelope has required fields", () => {
    const envelope: RunEnvelope = {
      run_id: "test-run-001",
      parent_run_id: null,
      agent_id: "test-agent@0.1.0",
      base_ref: "main",
      repo_path: "repo://test",
      objective: "test objective",
      policy_profile: "ci_safe",
      budgets: { max_time_ms: 60000, max_tokens: 1000 },
      timestamp: new Date().toISOString(),
    };
    assert.equal(envelope.run_id, "test-run-001");
    assert.equal(envelope.parent_run_id, null);
  });

  it("BaseEvent has required fields", () => {
    const event: BaseEvent = {
      run_id: "test-run-001",
      step_id: 1,
      event: "run.started",
      timestamp: new Date().toISOString(),
      agent_id: "test-agent@0.1.0",
    };
    assert.equal(event.step_id, 1);
    assert.equal(event.event, "run.started");
  });

  it("constants are defined", () => {
    assert.equal(ARTIFACT_SCHEME, "artifact://");
    assert.equal(SECRET_SCHEME, "secret://");
    assert.equal(REPO_SCHEME, "repo://");
  });

  it("StructuredError has recoverable flag", () => {
    const err: StructuredError = {
      code: "BUILD_FAILED",
      message: "TypeScript compilation failed",
      recoverable: true,
    };
    assert.equal(err.recoverable, true);
  });
});
