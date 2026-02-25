/**
 * @agentio/cli-agent — CLI agent
 *
 * Interactive command-line interface for creating and managing agent runs.
 * Provides a REPL-style experience for interacting with the agent runtime.
 */

import { createAgent, startRun, shutdown } from "@agentio/agent-runtime";

/** Placeholder: start the CLI agent REPL */
export async function main(): Promise<void> {
  console.log("agentio cli-agent v0.1.0");
  console.log("Type 'help' for available commands.");
  // TODO: implement CLI REPL
}

// Run if executed directly
if (typeof require !== "undefined" && require.main === module) {
  main().catch(console.error);
}
