/**
 * @agentio/agent-runtime — Agent runtime
 *
 * Orchestrate runs, policies, skills, and drivers into a complete agent loop.
 * This is the top-level package that wires all kernel and driver subsystems together.
 */

import type { RunEnvelope, PolicyProfile } from "@agentio/protocol";
import { createRun, finaliseRun } from "@agentio/kernel-run";
import { evaluate } from "@agentio/kernel-policy";
import { listSkills } from "@agentio/skills-runtime";
import { listTools } from "@agentio/driver-exec";
import { connect } from "@agentio/driver-mcp";

export interface AgentConfig {
  policyProfile: PolicyProfile;
  mcpServers: string[];
  maxConcurrentRuns: number;
}

/** Placeholder: create an agent runtime with the given configuration */
export function createAgent(_config: AgentConfig): { agentId: string } {
  return { agentId: "agent-placeholder" };
}

/** Placeholder: start an agent run */
export async function startRun(
  _agentId: string,
  _envelope: RunEnvelope
): Promise<{ runId: string }> {
  const run = createRun(_envelope);
  return { runId: run.runId };
}

/** Placeholder: stop all active runs and shut down the agent */
export async function shutdown(_agentId: string): Promise<void> {
  // TODO: implement graceful shutdown
}
