/**
 * @agentio/agent-runtime — Agent runtime with AI SDK v6 integration
 *
 * Orchestrate runs, policies, skills, and drivers into a complete agent loop.
 * This is the top-level package that wires all kernel and driver subsystems together.
 *
 * AI SDK dependencies (ai, @ai-sdk/anthropic) exist ONLY here and in apps.
 * Protocol and kernel layers stay pure.
 */

// ── AgentLoop (OODA cycle) ───────────────────────────────────────────────────

export { AgentLoop } from "./agent-loop.js";
export type { AgentLoopConfig } from "./agent-loop.js";

// ── Bridge modules ───────────────────────────────────────────────────────────

export { toUsageSnapshot, accumulateUsage, toBudgetUsage } from "./usage-bridge.js";
export { toAiSdkMessages, fromAiSdkAssistantContent, extractText } from "./message-bridge.js";
export { bridgeTools, createPolicyGate } from "./tool-bridge.js";
export type { ToolExecutor, PolicyGate, BridgeToolsOptions } from "./tool-bridge.js";
export { buildSystemPrompt } from "./prompt-builder.js";
export type { PromptContext } from "./prompt-builder.js";

// ── Legacy exports (backwards compat) ────────────────────────────────────────

import type { RunEnvelope, PolicyProfile } from "@agentio/protocol";
import { createRun } from "@agentio/kernel-run";

export interface AgentConfig {
  policyProfile: PolicyProfile;
  mcpServers: string[];
  maxConcurrentRuns: number;
}

export function createAgent(_config: AgentConfig): { agentId: string } {
  return { agentId: "agent-placeholder" };
}

export async function startRun(
  _agentId: string,
  _envelope: RunEnvelope,
): Promise<{ runId: string }> {
  const run = createRun(_envelope);
  return { runId: run.runId };
}

export async function shutdown(_agentId: string): Promise<void> {
  // Legacy placeholder
}
