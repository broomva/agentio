/**
 * @agentio/kernel-integration — Cross-kernel integration test harness
 *
 * Wires RunManager + PolicyEngine + ArtifactStore into a single
 * composable test fixture for verifying end-to-end kernel flows.
 */

import type {
  RunEnvelope,
  PolicyProfile,
  PolicyEvaluation,
  RunBudgets,
  StructuredError,
  AgentEvent,
  RunSummary,
  ArtifactHandle,
} from "@agentio/protocol";
import { createRunEnvelope, createError } from "@agentio/protocol";
import { RunManager } from "@agentio/kernel-run";
import type { RunState } from "@agentio/kernel-run";
import { evaluate, checkBudget } from "@agentio/kernel-policy";
import type { BudgetUsage } from "@agentio/kernel-policy";
import { ArtifactStore } from "@agentio/kernel-artifact";

export interface KernelHarnessConfig {
  profile: PolicyProfile;
  budgets?: RunBudgets;
}

/**
 * KernelHarness wires all kernel subsystems together into a single
 * test fixture that exercises the full create → policy → tool → artifact → complete flow.
 */
export class KernelHarness {
  readonly runManager: RunManager;
  readonly artifactStore: ArtifactStore;
  readonly profile: PolicyProfile;
  private policyViolations = 0;

  constructor(config: KernelHarnessConfig) {
    this.runManager = new RunManager();
    this.artifactStore = new ArtifactStore();
    this.profile = config.profile;
  }

  /** Create and start a run, returning the run state. */
  createRun(params: Pick<RunEnvelope, "agent_id" | "objective"> & Partial<RunEnvelope>): RunState {
    const envelope = createRunEnvelope({
      ...params,
      budgets: params.budgets ?? this.profile.budgets,
      policy_profile: this.profile.name,
    });
    const state = this.runManager.create(envelope);
    this.runManager.start(envelope.run_id);
    return state;
  }

  /** Evaluate a policy check for an action during a run. Returns the decision. */
  evaluatePolicy(action: string, scope: string): PolicyEvaluation {
    const evaluation = evaluate(this.profile, action, scope);
    if (evaluation.decision === "DENY") {
      this.policyViolations++;
    }
    return evaluation;
  }

  /** Record a tool call event on a run. */
  recordToolCall(runId: string): AgentEvent {
    return this.runManager.append(runId, "tool.called");
  }

  /** Record an artifact creation event on a run. */
  recordArtifactCreated(runId: string): AgentEvent {
    return this.runManager.append(runId, "artifact.created");
  }

  /** Store an artifact and return its handle. */
  async storeArtifact(data: string, mime: string, runId: string): Promise<ArtifactHandle> {
    return this.artifactStore.storeString(data, mime, runId);
  }

  /** Check if the run's current usage is within budget. */
  checkBudget(runId: string): { within_budget: boolean; violations: string[] } {
    const run = this.runManager.get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    const usage: BudgetUsage = {
      elapsed_ms: run.started_at ? Date.now() - new Date(run.started_at).getTime() : 0,
      tokens_used: 0,
      tool_calls: run.tool_calls,
      artifacts_mb: this.artifactStore.listByRun(runId).reduce((sum, m) => sum + m.size, 0) / (1024 * 1024),
    };

    return checkBudget(run.envelope.budgets, usage);
  }

  /** Complete a run successfully. */
  completeRun(runId: string): RunSummary {
    return this.runManager.complete(runId);
  }

  /** Fail a run with an error. */
  failRun(runId: string, error: StructuredError): RunSummary {
    return this.runManager.fail(runId, error);
  }

  /** Get the total number of policy violations across all runs. */
  get totalPolicyViolations(): number {
    return this.policyViolations;
  }
}

/** Create a standard CI-safe policy profile for testing. */
export function createTestProfile(overrides?: Partial<PolicyProfile>): PolicyProfile {
  return {
    name: overrides?.name ?? "test_ci_safe",
    budgets: overrides?.budgets ?? {
      max_time_ms: 60_000,
      max_tokens: 10_000,
      max_tool_calls: 50,
      max_artifacts_mb: 10,
    },
    rules: overrides?.rules ?? [
      { action: "secret.log", scope: "*", decision: "DENY", reason: "Never log secrets" },
      { action: "file.write", scope: ".env*", decision: "DENY", reason: "No .env writes" },
      { action: "exec.run", scope: "rm -rf", decision: "DENY", reason: "No recursive deletion" },
      { action: "git.push", scope: "refs/heads/main", decision: "REQUIRE_APPROVAL", reason: "Main branch push" },
      { action: "git.force_push", scope: "*", decision: "REQUIRE_APPROVAL", reason: "Force push is destructive" },
      { action: "file.read", scope: "**/*", decision: "ALLOW" },
      { action: "file.write", scope: "packages/**/*.ts", decision: "ALLOW" },
      { action: "git.push", scope: "refs/heads/feature/*", decision: "ALLOW" },
      { action: "git.commit", scope: "refs/heads/*", decision: "ALLOW" },
      { action: "exec.run", scope: "scripts/**", decision: "ALLOW" },
    ],
  };
}
