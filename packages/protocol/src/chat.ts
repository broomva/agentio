/**
 * @agentio/protocol — Chat & streaming types
 *
 * AI-SDK-agnostic types structurally compatible with AI SDK v6.
 * The bridge in agent-runtime maps between these and AI SDK types.
 *
 * Zero external dependencies.
 */

// ── Content Parts ────────────────────────────────────────────────────────────

export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolCallPart {
  type: "tool-call";
  tool_call_id: string;
  tool_name: string;
  args: unknown;
}

export interface ToolResultPart {
  type: "tool-result";
  tool_call_id: string;
  tool_name: string;
  result: unknown;
  is_error?: boolean;
}

export type ChatPart = TextPart | ToolCallPart | ToolResultPart;

// ── Messages ─────────────────────────────────────────────────────────────────

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string | ChatPart[];
  metadata?: Record<string, unknown>;
}

// ── Tool Invocation ──────────────────────────────────────────────────────────

/** A complete tool call + result record for the event log. */
export interface ToolInvocation {
  tool_call_id: string;
  tool_name: string;
  args: unknown;
  result: unknown;
  is_error: boolean;
  duration_ms: number;
  step_index: number;
}

// ── Usage ────────────────────────────────────────────────────────────────────

/** Maps to AI SDK LanguageModelUsage (promptTokens/completionTokens/totalTokens). */
export interface UsageSnapshot {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
}

// ── Stream State ─────────────────────────────────────────────────────────────

export type StreamPhase =
  | "idle"
  | "connecting"
  | "streaming"
  | "tool-calling"
  | "complete"
  | "error";

/** What apps bind to for UI — updated as the stream progresses. */
export interface StreamState {
  phase: StreamPhase;
  step_index: number;
  partial_text: string;
  pending_tool_calls: Array<{
    tool_call_id: string;
    tool_name: string;
    partial_args: string;
  }>;
  completed_invocations: ToolInvocation[];
  cumulative_usage: UsageSnapshot;
  error?: string;
}

// ── Step Record ──────────────────────────────────────────────────────────────

export type FinishReason =
  | "stop"
  | "tool-calls"
  | "length"
  | "content-filter"
  | "error";

/** One LLM roundtrip in a multi-step loop. */
export interface StepRecord {
  step_index: number;
  messages_in: ChatMessage[];
  message_out: ChatMessage;
  tool_invocations: ToolInvocation[];
  usage: UsageSnapshot;
  finish_reason: FinishReason;
  duration_ms: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const CHAT_ROLES: readonly ChatRole[] = [
  "system",
  "user",
  "assistant",
  "tool",
] as const;

export const STREAM_PHASES: readonly StreamPhase[] = [
  "idle",
  "connecting",
  "streaming",
  "tool-calling",
  "complete",
  "error",
] as const;

export const FINISH_REASONS: readonly FinishReason[] = [
  "stop",
  "tool-calls",
  "length",
  "content-filter",
  "error",
] as const;

// ── Factory Functions ────────────────────────────────────────────────────────

/** Create an empty UsageSnapshot. */
export function emptyUsage(): UsageSnapshot {
  return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
}

/** Create an idle StreamState. */
export function idleStreamState(): StreamState {
  return {
    phase: "idle",
    step_index: 0,
    partial_text: "",
    pending_tool_calls: [],
    completed_invocations: [],
    cumulative_usage: emptyUsage(),
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

import type { ValidationResult } from "./index.js";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate a ChatMessage at runtime. */
export function validateChatMessage(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(obj)) {
    return { valid: false, errors: ["must be an object"] };
  }
  if (typeof obj.role !== "string" || !(CHAT_ROLES as readonly string[]).includes(obj.role))
    errors.push(`role must be one of: ${CHAT_ROLES.join(", ")}`);
  if (typeof obj.content !== "string" && !Array.isArray(obj.content))
    errors.push("content must be a string or array");
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Validate a UsageSnapshot at runtime. */
export function validateUsageSnapshot(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(obj)) {
    return { valid: false, errors: ["must be an object"] };
  }
  if (typeof obj.input_tokens !== "number" || obj.input_tokens < 0)
    errors.push("input_tokens must be a non-negative number");
  if (typeof obj.output_tokens !== "number" || obj.output_tokens < 0)
    errors.push("output_tokens must be a non-negative number");
  if (typeof obj.total_tokens !== "number" || obj.total_tokens < 0)
    errors.push("total_tokens must be a non-negative number");
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
