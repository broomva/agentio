import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execute, listTools } from "../src/index.js";
import type { ToolContract } from "@agentio/protocol";

describe("driver-exec", () => {
  it("execute returns a zero exit code by default", async () => {
    const tool: ToolContract = {
      name: "test-tool",
      description: "a test tool",
      input_schema: {},
      output_schema: {},
      capabilities: [],
      idempotent: true,
    };
    const result = await execute(tool, {});
    assert.equal(result.exitCode, 0);
    assert.equal(result.durationMs, 0);
  });

  it("listTools returns an empty array", () => {
    assert.deepEqual(listTools(), []);
  });
});
