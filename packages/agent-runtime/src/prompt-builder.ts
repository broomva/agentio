/**
 * Prompt builder — assembles the system prompt from schema, state, policy, and memory.
 */

import type { AppSchema, AgentState, PolicyProfile, BudgetUsage } from "@agentio/protocol";
import { describeSchema } from "@agentio/kernel-schema";

export interface PromptContext {
  schema: AppSchema;
  agentState: AgentState;
  policyProfile: PolicyProfile;
  memoryEntries?: Array<{ key: string; summary: string }>;
  customInstructions?: string;
}

/** Build the system prompt for the LLM. */
export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  // Identity
  sections.push(`You are an autonomous agent operating within the agentio framework.`);
  sections.push(`Your schema defines your capabilities and domain knowledge.\n`);

  // Schema description
  sections.push(describeSchema(ctx.schema));
  sections.push("");

  // Current state
  sections.push("## Current State");
  sections.push(`- Mode: ${ctx.agentState.mode}`);
  if (ctx.agentState.current_objective) {
    sections.push(`- Objective: ${ctx.agentState.current_objective}`);
  }
  const budget = ctx.agentState.cumulative_budget;
  sections.push(
    `- Budget used: ${budget.tokens_used} tokens, ${budget.tool_calls} tool calls, ${budget.elapsed_ms}ms elapsed`,
  );
  sections.push("");

  // Policy constraints
  sections.push("## Policy Constraints");
  sections.push(`- Profile: ${ctx.policyProfile.name}`);
  sections.push(
    `- Budget limits: ${ctx.policyProfile.budgets.max_tokens} tokens, ${ctx.policyProfile.budgets.max_time_ms}ms`,
  );
  if (ctx.policyProfile.rules.length > 0) {
    for (const rule of ctx.policyProfile.rules.slice(0, 5)) {
      sections.push(`  - ${rule.action}@${rule.scope}: ${rule.decision}${rule.reason ? ` (${rule.reason})` : ""}`);
    }
    if (ctx.policyProfile.rules.length > 5) {
      sections.push(`  - ... and ${ctx.policyProfile.rules.length - 5} more rules`);
    }
  }
  sections.push("");

  // Memory context
  if (ctx.memoryEntries && ctx.memoryEntries.length > 0) {
    sections.push("## Memory");
    for (const entry of ctx.memoryEntries) {
      sections.push(`- **${entry.key}**: ${entry.summary}`);
    }
    sections.push("");
  }

  // Custom instructions
  if (ctx.customInstructions) {
    sections.push("## Additional Instructions");
    sections.push(ctx.customInstructions);
    sections.push("");
  }

  // Behavioral guidelines
  sections.push("## Guidelines");
  sections.push("- Use tools to accomplish objectives. Each tool call is tracked against budget.");
  sections.push("- If a tool is denied by policy, explain to the user and suggest alternatives.");
  sections.push("- Report when budget limits are approaching.");
  sections.push("- Be concise and action-oriented.");

  return sections.join("\n");
}
