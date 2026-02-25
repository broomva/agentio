/**
 * @agentio/protocol — Agent & Session state types
 *
 * State types for the .agent/ filesystem.
 * Zero external dependencies.
 */

import type { RunBudgets, RunStatus, ValidationResult } from "./index.js";

// ─── Agent State ────────────────────────────────────────────────────────────

/** A recorded decision for agent reflection. */
export interface Decision {
  timestamp: string;
  action: string;
  reasoning: string;
  outcome: "success" | "failure" | "pending";
}

/** Budget usage tracking across a session. */
export interface BudgetUsage {
  elapsed_ms: number;
  tokens_used: number;
  tool_calls: number;
  artifacts_mb: number;
}

/** Agent self-state — what the agent knows about itself right now. */
export interface AgentState {
  mode: "idle" | "planning" | "executing" | "waiting" | "error";
  current_objective: string | null;
  working_memory_keys: string[];
  recent_decisions: Decision[];
  cumulative_budget: BudgetUsage;
}

// ─── Session State ──────────────────────────────────────────────────────────

/** Current session — who is interacting, through what interface. */
export interface SessionState {
  session_id: string;
  agent_id: string;
  interface: "cli" | "chat" | "web" | "api";
  started_at: string;
  last_activity_at: string;
  active_run_id: string | null;
  context: Record<string, unknown>;
}

// ─── Run Index ──────────────────────────────────────────────────────────────

/** A single entry in the run index. */
export interface RunIndexEntry {
  run_id: string;
  agent_id: string;
  objective: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
}

/** The run index — maps run IDs to summaries. */
export interface RunIndex {
  version: number;
  entries: RunIndexEntry[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const AGENT_MODES = [
  "idle",
  "planning",
  "executing",
  "waiting",
  "error",
] as const;

export const INTERFACE_TYPES = ["cli", "chat", "web", "api"] as const;

export const DECISION_OUTCOMES = ["success", "failure", "pending"] as const;

// ─── Validation ─────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate an AgentState at runtime. */
export function validateAgentState(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(obj)) {
    return { valid: false, errors: ["must be an object"] };
  }
  if (typeof obj.mode !== "string" || !(AGENT_MODES as readonly string[]).includes(obj.mode))
    errors.push(`mode must be one of: ${AGENT_MODES.join(", ")}`);
  if (obj.current_objective !== null && typeof obj.current_objective !== "string")
    errors.push("current_objective must be a string or null");
  if (!Array.isArray(obj.working_memory_keys))
    errors.push("working_memory_keys must be an array");
  if (!Array.isArray(obj.recent_decisions))
    errors.push("recent_decisions must be an array");
  if (!isObject(obj.cumulative_budget))
    errors.push("cumulative_budget must be an object");
  else {
    const b = obj.cumulative_budget;
    if (typeof b.elapsed_ms !== "number")
      errors.push("cumulative_budget.elapsed_ms must be a number");
    if (typeof b.tokens_used !== "number")
      errors.push("cumulative_budget.tokens_used must be a number");
    if (typeof b.tool_calls !== "number")
      errors.push("cumulative_budget.tool_calls must be a number");
    if (typeof b.artifacts_mb !== "number")
      errors.push("cumulative_budget.artifacts_mb must be a number");
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Validate a SessionState at runtime. */
export function validateSessionState(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(obj)) {
    return { valid: false, errors: ["must be an object"] };
  }
  if (typeof obj.session_id !== "string" || obj.session_id.length === 0)
    errors.push("session_id must be a non-empty string");
  if (typeof obj.agent_id !== "string" || obj.agent_id.length === 0)
    errors.push("agent_id must be a non-empty string");
  if (typeof obj.interface !== "string" || !(INTERFACE_TYPES as readonly string[]).includes(obj.interface))
    errors.push(`interface must be one of: ${INTERFACE_TYPES.join(", ")}`);
  if (typeof obj.started_at !== "string")
    errors.push("started_at must be a string");
  if (typeof obj.last_activity_at !== "string")
    errors.push("last_activity_at must be a string");
  if (obj.active_run_id !== null && typeof obj.active_run_id !== "string")
    errors.push("active_run_id must be a string or null");
  if (!isObject(obj.context))
    errors.push("context must be an object");
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Validate a RunIndex at runtime. */
export function validateRunIndex(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(obj)) {
    return { valid: false, errors: ["must be an object"] };
  }
  if (typeof obj.version !== "number")
    errors.push("version must be a number");
  if (!Array.isArray(obj.entries))
    errors.push("entries must be an array");
  else {
    for (let i = 0; i < obj.entries.length; i++) {
      const e = obj.entries[i] as unknown;
      if (!isObject(e)) {
        errors.push(`entries[${i}] must be an object`);
        continue;
      }
      if (typeof e.run_id !== "string" || e.run_id.length === 0)
        errors.push(`entries[${i}].run_id must be a non-empty string`);
      if (typeof e.status !== "string")
        errors.push(`entries[${i}].status must be a string`);
    }
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
