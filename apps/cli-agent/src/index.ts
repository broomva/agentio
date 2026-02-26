/**
 * @agentio/cli-agent — Interactive REPL with streaming
 *
 * Creates an AgentLoop with an Anthropic model, reads user input via readline,
 * and streams agent responses to stdout.
 */

import * as readline from "node:readline";
import { AgentLoop } from "@agentio/agent-runtime";
import type { StepRecord } from "@agentio/protocol";

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_MODEL_ID = "claude-sonnet-4-20250514";

async function createModel() {
  // Dynamic import to avoid hard failure if env var is not set
  const { anthropic } = await import("@ai-sdk/anthropic");
  const modelId = process.env.AGENTIO_MODEL ?? DEFAULT_MODEL_ID;
  return anthropic(modelId);
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  console.log("agentio cli-agent v0.1.0");
  console.log("─".repeat(40));

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("\x1b[33m⚠ ANTHROPIC_API_KEY not set. Set it to use the LLM.\x1b[0m");
    console.log("  export ANTHROPIC_API_KEY=sk-ant-...\n");
  }

  let model;
  try {
    model = await createModel();
  } catch (err) {
    console.error("Failed to create model:", err);
    process.exit(1);
  }

  const rootDir = process.env.AGENTIO_ROOT ?? process.cwd();

  const loop = new AgentLoop({
    model,
    rootDir,
    agentId: "cli-agent@0.1.0",
    policyProfile: {
      name: "cli_interactive",
      rules: [
        { action: "tool.execute", scope: "*", decision: "ALLOW" },
      ],
      budgets: {
        max_time_ms: 3_600_000,
        max_tokens: 500_000,
        max_tool_calls: 100,
      },
    },
    customInstructions: "You are running in an interactive CLI. Be concise and helpful.",
    onStepComplete: (step: StepRecord) => {
      // Show tool calls
      for (const inv of step.tool_invocations) {
        console.log(`\x1b[33m  [tool] ${inv.tool_name}(${JSON.stringify(inv.args)})\x1b[0m`);
      }
    },
  });

  console.log("Booting agent...");
  await loop.boot();

  const schema = loop.getSchema();
  if (schema) {
    console.log(`Schema loaded: ${schema.name} v${schema.version}`);
    console.log(`  ${schema.capabilities.length} capabilities, ${schema.entities.length} entities`);
  } else {
    console.log("No schema found — running with default capabilities.");
  }
  console.log("─".repeat(40));
  console.log("Type your message. 'exit' or 'quit' to leave.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\x1b[36m> \x1b[0m",
  });

  rl.prompt();

  rl.on("line", async (input: string) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === "exit" || trimmed === "quit") {
      console.log("\nShutting down...");
      await loop.shutdown();
      rl.close();
      return;
    }

    if (trimmed === "/history") {
      const history = loop.getHistory();
      console.log(`\n${history.length} messages in history.`);
      for (const msg of history.slice(-6)) {
        const text = typeof msg.content === "string"
          ? msg.content.slice(0, 80)
          : "[complex content]";
        console.log(`  \x1b[90m${msg.role}:\x1b[0m ${text}`);
      }
      console.log();
      rl.prompt();
      return;
    }

    if (trimmed === "/usage") {
      const state = loop.getStreamState();
      const u = state.cumulative_usage;
      console.log(`\nUsage: ${u.input_tokens} in / ${u.output_tokens} out / ${u.total_tokens} total tokens\n`);
      rl.prompt();
      return;
    }

    try {
      process.stdout.write("\x1b[32m");
      let lastPhase: string | null = null;

      for await (const state of loop.tick(trimmed, "cli")) {
        if (state.phase === "complete" && lastPhase !== "complete") {
          // Print the final text
          process.stdout.write(state.partial_text);
          process.stdout.write("\x1b[0m\n");

          // Show usage summary
          const u = state.cumulative_usage;
          if (u.total_tokens > 0) {
            console.log(
              `\x1b[90m  ─ ${u.input_tokens}↑ ${u.output_tokens}↓ tokens\x1b[0m`,
            );
          }
        } else if (state.phase === "error") {
          process.stdout.write("\x1b[0m\n");
          console.error(`\x1b[31mError: ${state.error}\x1b[0m`);
        }
        lastPhase = state.phase;
      }
    } catch (err) {
      process.stdout.write("\x1b[0m\n");
      console.error(`\x1b[31mError: ${err}\x1b[0m`);
    }

    console.log();
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("Goodbye!");
    process.exit(0);
  });
}

// Run if executed directly
main().catch(console.error);
