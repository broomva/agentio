/**
 * Tool bridge — converts agentio ToolContract[] → AI SDK ToolSet.
 *
 * Uses AI SDK's tool() + jsonSchema() to wrap each contract.
 * The execute function delegates to a caller-provided ToolExecutor callback.
 */

import type { ToolContract, PolicyProfile, PolicyEvaluation } from "@agentio/protocol";
import { tool, jsonSchema } from "ai";
import type { ToolSet } from "ai";
import { evaluate } from "@agentio/kernel-policy";

/** Callback that actually runs a tool. Provided by AgentLoop. */
export type ToolExecutor = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/** Callback that gates tool execution via policy. */
export type PolicyGate = (
  toolName: string,
  args: Record<string, unknown>,
) => PolicyEvaluation;

export interface BridgeToolsOptions {
  executor: ToolExecutor;
  policyGate?: PolicyGate;
}

/** Convert ToolContract[] → AI SDK ToolSet, wiring execution through the bridge. */
export function bridgeTools(
  contracts: ToolContract[],
  options: BridgeToolsOptions,
): ToolSet {
  const tools: ToolSet = {};

  for (const contract of contracts) {
    tools[contract.name] = tool({
      description: contract.description,
      inputSchema: jsonSchema(contract.input_schema as any),
      execute: async (args: Record<string, unknown>) => {
        // Policy gate check
        if (options.policyGate) {
          const evaluation = options.policyGate(contract.name, args);
          if (evaluation.decision === "DENY") {
            return { error: `Policy denied: ${evaluation.reason}`, denied: true };
          }
          if (evaluation.decision === "REQUIRE_APPROVAL") {
            return {
              error: `Requires approval: ${evaluation.reason}`,
              requires_approval: true,
            };
          }
        }

        // Delegate to executor
        return options.executor(contract.name, args);
      },
    });
  }

  return tools;
}

/** Create a PolicyGate from a PolicyProfile. */
export function createPolicyGate(profile: PolicyProfile): PolicyGate {
  return (toolName: string, _args: Record<string, unknown>) => {
    return evaluate(profile, "tool.execute", toolName);
  };
}
