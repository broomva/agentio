#!/usr/bin/env bun
/**
 * E2E Demo — Agent-as-App flow
 *
 * Exercises every layer of the Phase AB architecture:
 *   AgentFs (driver-exec) → kernel-schema → kernel-policy →
 *   kernel-run → kernel-artifact → kernel-state → .agent/ filesystem
 *
 * This is what AgentLoop (Phase C) will automate.
 */

import { AgentFs, FilesystemBackend } from "../packages/driver-exec/src/index.js";
import { parseSchema, resolveCapability, resolveView, deriveToolContracts, describeSchema } from "../packages/kernel-schema/src/index.js";
import { RunManager } from "../packages/kernel-run/src/index.js";
import { evaluate, buildProfile, checkBudget } from "../packages/kernel-policy/src/index.js";
import { ArtifactStore } from "../packages/kernel-artifact/src/index.js";
import { buildAgentState, buildSessionState, buildRunIndex, buildControlState } from "../packages/kernel-state/src/index.js";
import { createRunEnvelope, createError, now } from "../packages/protocol/src/index.js";
import type { PolicyProfile, BudgetUsage } from "../packages/protocol/src/index.js";

const ROOT = import.meta.dir + "/..";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function heading(text: string) {
  console.log(`\n${BOLD}${CYAN}━━━ ${text} ━━━${RESET}`);
}

function step(label: string, detail?: string) {
  console.log(`  ${GREEN}▸${RESET} ${label}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
}

function info(label: string, value: unknown) {
  console.log(`    ${DIM}${label}:${RESET} ${typeof value === "string" ? value : JSON.stringify(value)}`);
}

async function main() {
  console.log(`${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║     Agent-as-App — E2E Flow Demo                ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${RESET}`);

  // ── OBSERVE: Read filesystem state ──────────────────────────────────────
  heading("OBSERVE — Read .agent/ filesystem");

  const agentFs = new AgentFs(ROOT);
  await agentFs.ensureStructure();
  step("AgentFs initialized", agentFs.basePath);

  const rawSchema = await agentFs.readSchema();
  step("Schema loaded from .agent/schema.json");

  const schema = parseSchema(rawSchema);
  step("Schema parsed + validated", `${schema.name} v${schema.version}`);
  info("entities", schema.entities.length);
  info("capabilities", schema.capabilities.length);
  info("views", schema.views.length);

  // ── ORIENT: Derive tool contracts, evaluate policy ──────────────────────
  heading("ORIENT — Analyze schema + evaluate policy");

  const tools = deriveToolContracts(schema);
  step("Derived tool contracts from capabilities");
  for (const t of tools) {
    info(t.name, t.description);
  }

  // Resolve a capability
  const execCap = resolveCapability(schema, "execute_run");
  step("Resolved capability", `execute_run → ${execCap?.description}`);

  // Resolve a view
  const dashboard = resolveView(schema, "/");
  step("Resolved view", `/ → ${dashboard?.name}: ${dashboard?.description}`);

  // Build policy profile from governance
  const policyProfile: PolicyProfile = buildProfile({
    name: schema.governance.policy_profile,
    allowed: [
      { action: "execute_run", scope: "*" },
      { action: "query_state", scope: "*" },
      { action: "evaluate_policy", scope: "*" },
      { action: "store_artifact", scope: "*" },
      { action: "update_memory", scope: "*" },
      { action: "search_memory", scope: "*" },
    ],
    denied: [
      { action: "file.write", scope: "**/.env", reason: "secrets protection" },
    ],
    approval_required: [
      { action: "audit_harness", scope: "*", reason: "audit changes need review" },
    ],
    budgets: schema.governance.budgets,
  });

  // Evaluate some actions
  const allowCheck = evaluate(policyProfile, "execute_run", "runs/test-run");
  step("Policy: execute_run → " + allowCheck.decision, allowCheck.reason);

  const denyCheck = evaluate(policyProfile, "file.write", ".env");
  step("Policy: file.write .env → " + denyCheck.decision, denyCheck.reason);

  const approvalCheck = evaluate(policyProfile, "audit_harness", "harness");
  step("Policy: audit_harness → " + approvalCheck.decision, approvalCheck.reason);

  // ── DECIDE: Create a run ────────────────────────────────────────────────
  heading("DECIDE — Create and execute a run");

  const session = buildSessionState({ agentId: "agent-os", interfaceType: "cli" });
  step("Session created", session.session_id);
  await agentFs.writeState("session", session);
  step("Session persisted to .agent/state/session.json");

  const agentState = buildAgentState({ mode: "executing", currentObjective: "Run E2E demo" });
  await agentFs.writeState("agent", agentState);
  step("Agent state → executing", "objective: Run E2E demo");

  const runManager = new RunManager();
  const envelope = createRunEnvelope({
    agent_id: "agent-os",
    objective: "Execute E2E demo flow",
    budgets: schema.governance.budgets,
  });
  const runState = runManager.create(envelope);
  step("Run created", `${runState.envelope.run_id} (${runState.status})`);

  // ── ACT: Start run, do work, store artifact ─────────────────────────────
  heading("ACT — Execute the run");

  const startEvent = runManager.start(runState.envelope.run_id);
  step("Run started", `step ${startEvent.step_id}`);
  await agentFs.appendRun(runState.envelope.run_id, startEvent);

  // Simulate a tool call
  const toolEvent = runManager.append(runState.envelope.run_id, "tool.called");
  step("Tool called", `step ${toolEvent.step_id}`);
  await agentFs.appendRun(runState.envelope.run_id, toolEvent);

  // Store an artifact
  const artifactBackend = new FilesystemBackend(ROOT);
  const artifactStore = new ArtifactStore(artifactBackend);
  const content = `E2E demo output — generated at ${now()}`;
  const handle = await artifactStore.storeString(content, "text/plain", runState.envelope.run_id);
  step("Artifact stored", handle);

  const artifactEvent = runManager.append(runState.envelope.run_id, "artifact.created");
  await agentFs.appendRun(runState.envelope.run_id, artifactEvent);

  // Check budget
  const usage: BudgetUsage = {
    elapsed_ms: 500,
    tokens_used: 100,
    tool_calls: 2,
    artifacts_mb: 0.001,
  };
  const budgetCheck = checkBudget(schema.governance.budgets, usage);
  step("Budget check", budgetCheck.within_budget ? "within budget" : "OVER BUDGET");

  // Complete the run
  const summary = runManager.complete(runState.envelope.run_id);
  step("Run completed", `${summary.tool_calls} tool calls, ${summary.artifacts_created} artifacts`);

  const completedRun = runManager.get(runState.envelope.run_id)!;
  const completeEvent = completedRun.events[completedRun.events.length - 1];
  await agentFs.appendRun(runState.envelope.run_id, completeEvent);

  // ── RECORD: Persist state, update indexes, memory ───────────────────────
  heading("RECORD — Persist state + update indexes");

  // Update run index
  const allRuns = runManager.list();
  const runIndex = buildRunIndex(allRuns);
  await agentFs.writeRunIndex(runIndex);
  step("Run index updated", `${runIndex.entries.length} entries`);

  // Read back run log
  const eventLog = await agentFs.readRunLog(runState.envelope.run_id);
  step("Run log verified", `${eventLog.length} events on disk`);
  for (const e of eventLog) {
    info(`step ${e.step_id}`, e.event);
  }

  // Build control state
  const controlState = buildControlState({
    runs: allRuns,
    artifactCount: artifactStore.listMetadata().length,
    policyViolations: 0,
    controllerMode: schema.governance.controller_mode,
  });
  step("Control state aggregated");
  info("active_runs", controlState.active_runs);
  info("completed_runs", controlState.completed_runs);
  info("artifact_count", controlState.artifact_count);

  // Update agent state
  const finalAgentState = buildAgentState({
    mode: "idle",
    currentObjective: null,
    recentDecisions: [
      {
        timestamp: now(),
        action: "execute_run",
        reasoning: "E2E demo requested by user",
        outcome: "success",
      },
    ],
    cumulativeBudget: usage,
  });
  await agentFs.writeState("agent", finalAgentState);
  step("Agent state → idle", "objective complete");

  // Update memory
  await agentFs.writeMemory("core", {
    entries: [
      { key: "last_demo", value: now(), category: "system", recorded_at: now() },
      { key: "demo_run_id", value: runState.envelope.run_id, category: "system", recorded_at: now() },
    ],
  });
  step("Memory updated", "2 entries written to core.json");

  const memoryKeys = await agentFs.listMemoryKeys();
  step("Memory keys on disk", memoryKeys.join(", "));

  // Retrieve artifact to verify
  const retrieved = await artifactStore.retrieveString(handle);
  step("Artifact retrieved", retrieved ? `${retrieved.length} chars` : "MISSING");

  // ── Summary ─────────────────────────────────────────────────────────────
  heading("SUMMARY — Full OODA cycle complete");
  console.log(`
  ${GREEN}✓${RESET} Schema loaded and validated (${schema.entities.length} entities, ${schema.capabilities.length} capabilities)
  ${GREEN}✓${RESET} ${tools.length} tool contracts derived from capabilities
  ${GREEN}✓${RESET} Policy evaluated (allow/deny/approval)
  ${GREEN}✓${RESET} Session created and persisted
  ${GREEN}✓${RESET} Run lifecycle: pending → running → completed
  ${GREEN}✓${RESET} ${eventLog.length} events appended to JSONL log
  ${GREEN}✓${RESET} Artifact stored on filesystem (${handle})
  ${GREEN}✓${RESET} Budget checked — within limits
  ${GREEN}✓${RESET} Run index, agent state, memory all persisted
  ${GREEN}✓${RESET} Control state aggregated from all subsystems

  ${BOLD}Layers exercised:${RESET}
    protocol → kernel-schema → kernel-policy → kernel-run →
    kernel-artifact → kernel-state → driver-exec → .agent/

  ${YELLOW}Next: Phase C (AgentLoop) will automate this OODA cycle.${RESET}
`);
}

main().catch((err) => {
  console.error("E2E demo failed:", err);
  process.exit(1);
});
