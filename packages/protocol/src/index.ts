/**
 * @agentio/protocol — Core types, contracts, and validation
 *
 * This package has ZERO external dependencies.
 * All types are defined here and shared across the monorepo.
 */

// ─── Run Envelope ────────────────────────────────────────────────────────────

export interface RunEnvelope {
  run_id: string;
  parent_run_id: string | null;
  agent_id: string;
  base_ref: string;
  repo_path: string;
  objective: string;
  policy_profile: string;
  budgets: RunBudgets;
  timestamp: string;
}

export interface RunBudgets {
  max_time_ms: number;
  max_tokens: number;
  max_tool_calls?: number;
  max_artifacts_mb?: number;
}

export interface RunSummary {
  run_id: string;
  status: "completed" | "failed" | "cancelled";
  duration_ms: number;
  tool_calls: number;
  artifacts_created: number;
  errors: number;
}

// ─── Run Status ──────────────────────────────────────────────────────────────

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// ─── Events ──────────────────────────────────────────────────────────────────

export type EventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "tool.called"
  | "tool.result"
  | "artifact.created"
  | "policy.decision"
  | "policy.approval"
  | "metric.recorded";

export interface BaseEvent {
  run_id: string;
  step_id: number;
  event: EventType;
  timestamp: string;
  agent_id: string;
}

export interface RunStartedEvent extends BaseEvent {
  event: "run.started";
  envelope: RunEnvelope;
}

export interface RunCompletedEvent extends BaseEvent {
  event: "run.completed";
  summary: RunSummary;
}

export interface RunFailedEvent extends BaseEvent {
  event: "run.failed";
  error: StructuredError;
}

export interface ToolCalledEvent extends BaseEvent {
  event: "tool.called";
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent extends BaseEvent {
  event: "tool.result";
  tool: string;
  result: unknown;
  exit_code: number;
}

export interface ArtifactCreatedEvent extends BaseEvent {
  event: "artifact.created";
  uri: string;
  size: number;
  mime: string;
}

export interface PolicyDecisionEvent extends BaseEvent {
  event: "policy.decision";
  action: string;
  decision: PolicyDecision;
  reason: string;
}

export interface PolicyApprovalEvent extends BaseEvent {
  event: "policy.approval";
  action: string;
  approved_by: string;
}

export interface MetricRecordedEvent extends BaseEvent {
  event: "metric.recorded";
  name: string;
  value: number;
  unit: string;
}

export type AgentEvent =
  | RunStartedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | ToolCalledEvent
  | ToolResultEvent
  | ArtifactCreatedEvent
  | PolicyDecisionEvent
  | PolicyApprovalEvent
  | MetricRecordedEvent;

// ─── Artifacts ───────────────────────────────────────────────────────────────

/** Content-addressed artifact handle: `artifact://sha256/<hash>` */
export type ArtifactHandle = `artifact://${string}`;

export interface ArtifactMetadata {
  handle: ArtifactHandle;
  size: number;
  mime: string;
  created_at: string;
  run_id: string;
}

// ─── Policy ──────────────────────────────────────────────────────────────────

export type PolicyDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface PolicyRule {
  action: string;
  scope: string;
  decision: PolicyDecision;
  reason?: string;
  condition?: string;
}

export interface PolicyProfile {
  name: string;
  rules: PolicyRule[];
  budgets: RunBudgets;
}

export interface PolicyEvaluation {
  rule: PolicyRule | null;
  decision: PolicyDecision;
  reason: string;
  timestamp: string;
}

// ─── Tool Contracts ──────────────────────────────────────────────────────────

export interface ToolContract {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  capabilities: string[];
  idempotent: boolean;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export interface StructuredError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const ARTIFACT_SCHEME = "artifact://";
export const SECRET_SCHEME = "secret://";
export const REPO_SCHEME = "repo://";

export const EVENT_TYPES: readonly EventType[] = [
  "run.started",
  "run.completed",
  "run.failed",
  "tool.called",
  "tool.result",
  "artifact.created",
  "policy.decision",
  "policy.approval",
  "metric.recorded",
] as const;

export const RUN_STATUSES: readonly RunStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

// ─── Factory Functions ───────────────────────────────────────────────────────

/** Generate a UUID v4 using crypto (zero deps). */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Get current ISO timestamp. */
export function now(): string {
  return new Date().toISOString();
}

/** Create a new RunEnvelope with sensible defaults. */
export function createRunEnvelope(
  params: Pick<RunEnvelope, "agent_id" | "objective"> &
    Partial<Omit<RunEnvelope, "agent_id" | "objective">>
): RunEnvelope {
  return {
    run_id: params.run_id ?? generateId(),
    parent_run_id: params.parent_run_id ?? null,
    agent_id: params.agent_id,
    base_ref: params.base_ref ?? "main",
    repo_path: params.repo_path ?? `repo://${process.cwd()}`,
    objective: params.objective,
    policy_profile: params.policy_profile ?? "ci_safe",
    budgets: params.budgets ?? { max_time_ms: 3_600_000, max_tokens: 100_000 },
    timestamp: params.timestamp ?? now(),
  };
}

/** Create a BaseEvent with step tracking. */
export function createEvent<T extends EventType>(
  run_id: string,
  agent_id: string,
  step_id: number,
  event: T,
): BaseEvent & { event: T } {
  return { run_id, agent_id, step_id, event, timestamp: now() };
}

/** Create a StructuredError. */
export function createError(
  code: string,
  message: string,
  recoverable: boolean = false,
  details?: Record<string, unknown>,
): StructuredError {
  return { code, message, recoverable, details };
}

/** Build an artifact handle from a hex SHA-256 hash. */
export function artifactHandle(sha256hex: string): ArtifactHandle {
  return `artifact://sha256/${sha256hex}`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/** Validate a RunEnvelope at runtime. */
export function validateRunEnvelope(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["must be an object"] };
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.run_id !== "string" || o.run_id.length === 0)
    errors.push("run_id must be a non-empty string");
  if (typeof o.agent_id !== "string" || o.agent_id.length === 0)
    errors.push("agent_id must be a non-empty string");
  if (typeof o.objective !== "string")
    errors.push("objective must be a string");
  if (typeof o.timestamp !== "string")
    errors.push("timestamp must be a string");
  if (typeof o.policy_profile !== "string")
    errors.push("policy_profile must be a string");
  if (typeof o.budgets !== "object" || o.budgets === null)
    errors.push("budgets must be an object");
  else {
    const b = o.budgets as Record<string, unknown>;
    if (typeof b.max_time_ms !== "number")
      errors.push("budgets.max_time_ms must be a number");
    if (typeof b.max_tokens !== "number")
      errors.push("budgets.max_tokens must be a number");
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Validate a BaseEvent at runtime. */
export function validateEvent(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["must be an object"] };
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.run_id !== "string" || o.run_id.length === 0)
    errors.push("run_id must be a non-empty string");
  if (typeof o.step_id !== "number" || o.step_id < 0)
    errors.push("step_id must be a non-negative number");
  if (typeof o.event !== "string" || !EVENT_TYPES.includes(o.event as EventType))
    errors.push(`event must be one of: ${EVENT_TYPES.join(", ")}`);
  if (typeof o.timestamp !== "string")
    errors.push("timestamp must be a string");
  if (typeof o.agent_id !== "string" || o.agent_id.length === 0)
    errors.push("agent_id must be a non-empty string");
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Check if a string is a valid artifact handle. */
export function isArtifactHandle(s: string): s is ArtifactHandle {
  return s.startsWith(ARTIFACT_SCHEME);
}
