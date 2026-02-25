import { describe, it, expect } from "bun:test";
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
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBe(0);
  });

  it("listTools returns an empty array", () => {
    expect(listTools()).toEqual([]);
  });
});
