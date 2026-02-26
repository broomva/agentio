import { describe, it, expect } from "bun:test";
import { bridgeTools, createPolicyGate } from "../src/tool-bridge.js";
import type { ToolContract, PolicyProfile } from "@agentio/protocol";

describe("tool-bridge", () => {
  const testContracts: ToolContract[] = [
    {
      name: "query_state",
      description: "Query agent state",
      input_schema: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
      },
      output_schema: { type: "object" },
      capabilities: [],
      idempotent: true,
    },
    {
      name: "store_artifact",
      description: "Store an artifact",
      input_schema: {
        type: "object",
        properties: {
          content: { type: "string" },
          mime: { type: "string" },
        },
      },
      output_schema: { type: "object" },
      capabilities: ["write"],
      idempotent: false,
    },
  ];

  it("creates a ToolSet with one entry per contract", () => {
    const tools = bridgeTools(testContracts, {
      executor: async () => ({ ok: true }),
    });
    expect(Object.keys(tools)).toEqual(["query_state", "store_artifact"]);
  });

  it("executor is called on tool execution", async () => {
    let calledWith: { name: string; args: unknown } | null = null;
    const tools = bridgeTools(testContracts, {
      executor: async (name, args) => {
        calledWith = { name, args };
        return { result: "done" };
      },
    });

    const queryTool = tools["query_state"] as any;
    const result = await queryTool.execute({ key: "agent" });
    expect(calledWith).toEqual({ name: "query_state", args: { key: "agent" } });
    expect(result).toEqual({ result: "done" });
  });

  it("policy gate denies tool execution", async () => {
    const profile: PolicyProfile = {
      name: "restrictive",
      rules: [
        { action: "tool.execute", scope: "store_artifact", decision: "DENY", reason: "No writes allowed" },
      ],
      budgets: { max_time_ms: 60000, max_tokens: 1000 },
    };

    const tools = bridgeTools(testContracts, {
      executor: async () => ({ ok: true }),
      policyGate: createPolicyGate(profile),
    });

    const storeTool = tools["store_artifact"] as any;
    const result = await storeTool.execute({ content: "test", mime: "text/plain" });
    expect(result).toHaveProperty("denied", true);
    expect(result.error).toContain("Policy denied");
  });

  it("policy gate allows tool execution", async () => {
    const profile: PolicyProfile = {
      name: "permissive",
      rules: [
        { action: "tool.execute", scope: "*", decision: "ALLOW" },
      ],
      budgets: { max_time_ms: 60000, max_tokens: 1000 },
    };

    const tools = bridgeTools(testContracts, {
      executor: async () => ({ result: "stored" }),
      policyGate: createPolicyGate(profile),
    });

    const storeTool = tools["store_artifact"] as any;
    const result = await storeTool.execute({ content: "test", mime: "text/plain" });
    expect(result).toEqual({ result: "stored" });
  });
});
