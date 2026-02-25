/**
 * @agentio/protocol — Core types and contracts
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
  decision: "ALLOW" | "DENY";
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

export interface PolicyRule {
  action: string;
  scope: string;
  decision: "allow" | "deny" | "require_approval";
  reason?: string;
  condition?: string;
}

export interface PolicyProfile {
  name: string;
  rules: PolicyRule[];
  budgets: RunBudgets;
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
