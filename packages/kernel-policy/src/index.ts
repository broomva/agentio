/**
 * @agentio/kernel-policy — Policy engine
 *
 * Evaluate policy rules against actions, enforce budgets,
 * and gate operations that require human approval.
 *
 * Pure logic — no I/O. Policy profiles are passed in, not loaded from disk.
 */

import type {
  PolicyProfile,
  PolicyRule,
  PolicyDecision,
  PolicyEvaluation,
  RunBudgets,
} from "@agentio/protocol";
import { now } from "@agentio/protocol";

// ─── Pattern Matching ───────────────────────────────────────────────────────

/** Check if a scope pattern matches an action scope using glob-like matching. */
export function matchesScope(pattern: string, scope: string): boolean {
  if (pattern === "*") return true;
  if (pattern === scope) return true;

  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex chars except * and ?
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");

  return new RegExp(`^${regexStr}$`).test(scope);
}

// ─── Rule Evaluation ────────────────────────────────────────────────────────

/** Find the first matching rule for an action+scope pair. */
export function findMatchingRule(
  rules: PolicyRule[],
  action: string,
  scope: string,
): PolicyRule | null {
  for (const rule of rules) {
    if (rule.action === action && matchesScope(rule.scope, scope)) {
      return rule;
    }
  }
  return null;
}

/** Evaluate an action against a policy profile. */
export function evaluate(
  profile: PolicyProfile,
  action: string,
  scope: string,
): PolicyEvaluation {
  const rule = findMatchingRule(profile.rules, action, scope);
  if (!rule) {
    return {
      rule: null,
      decision: "DENY",
      reason: `No rule matches action="${action}" scope="${scope}"; default deny`,
      timestamp: now(),
    };
  }
  return {
    rule,
    decision: rule.decision,
    reason: rule.reason ?? `Matched rule: ${rule.action} @ ${rule.scope}`,
    timestamp: now(),
  };
}

// ─── Budget Enforcement ─────────────────────────────────────────────────────

export interface BudgetUsage {
  elapsed_ms: number;
  tokens_used: number;
  tool_calls: number;
  artifacts_mb: number;
}

export interface BudgetCheck {
  within_budget: boolean;
  violations: string[];
}

/** Check if current usage is within budget constraints. */
export function checkBudget(
  budgets: RunBudgets,
  usage: BudgetUsage,
): BudgetCheck {
  const violations: string[] = [];

  if (usage.elapsed_ms > budgets.max_time_ms) {
    violations.push(
      `Time budget exceeded: ${usage.elapsed_ms}ms > ${budgets.max_time_ms}ms`,
    );
  }
  if (usage.tokens_used > budgets.max_tokens) {
    violations.push(
      `Token budget exceeded: ${usage.tokens_used} > ${budgets.max_tokens}`,
    );
  }
  if (
    budgets.max_tool_calls !== undefined &&
    usage.tool_calls > budgets.max_tool_calls
  ) {
    violations.push(
      `Tool call budget exceeded: ${usage.tool_calls} > ${budgets.max_tool_calls}`,
    );
  }
  if (
    budgets.max_artifacts_mb !== undefined &&
    usage.artifacts_mb > budgets.max_artifacts_mb
  ) {
    violations.push(
      `Artifact budget exceeded: ${usage.artifacts_mb}MB > ${budgets.max_artifacts_mb}MB`,
    );
  }

  return {
    within_budget: violations.length === 0,
    violations,
  };
}

// ─── Policy Profile Builder ─────────────────────────────────────────────────

/** Build a PolicyProfile from a YAML-like config object (parsed externally). */
export function buildProfile(config: {
  name: string;
  approval_required?: Array<{ action: string; scope: string; reason?: string }>;
  allowed?: Array<{ action: string; scope: string; condition?: string }>;
  denied?: Array<{ action: string; scope: string; reason?: string }>;
  budgets?: Partial<RunBudgets>;
}): PolicyProfile {
  const rules: PolicyRule[] = [];

  // Denied rules first (highest priority)
  if (config.denied) {
    for (const d of config.denied) {
      rules.push({
        action: d.action,
        scope: d.scope,
        decision: "DENY",
        reason: d.reason,
      });
    }
  }

  // Approval-required rules next
  if (config.approval_required) {
    for (const a of config.approval_required) {
      rules.push({
        action: a.action,
        scope: a.scope,
        decision: "REQUIRE_APPROVAL",
        reason: a.reason,
      });
    }
  }

  // Allowed rules last (lowest priority — only match if nothing else does)
  if (config.allowed) {
    for (const a of config.allowed) {
      rules.push({
        action: a.action,
        scope: a.scope,
        decision: "ALLOW",
        condition: a.condition,
      });
    }
  }

  return {
    name: config.name,
    rules,
    budgets: {
      max_time_ms: config.budgets?.max_time_ms ?? 3_600_000,
      max_tokens: config.budgets?.max_tokens ?? 100_000,
      max_tool_calls: config.budgets?.max_tool_calls,
      max_artifacts_mb: config.budgets?.max_artifacts_mb,
    },
  };
}

// ─── Convenience: evaluate multiple actions ─────────────────────────────────

export interface BatchEvalResult {
  action: string;
  scope: string;
  evaluation: PolicyEvaluation;
}

/** Evaluate multiple actions against a profile. */
export function evaluateBatch(
  profile: PolicyProfile,
  actions: Array<{ action: string; scope: string }>,
): BatchEvalResult[] {
  return actions.map(({ action, scope }) => ({
    action,
    scope,
    evaluation: evaluate(profile, action, scope),
  }));
}

/** Check if all actions in a batch are allowed. */
export function allAllowed(results: BatchEvalResult[]): boolean {
  return results.every((r) => r.evaluation.decision === "ALLOW");
}

/** Get actions that require approval from a batch. */
export function needsApproval(results: BatchEvalResult[]): BatchEvalResult[] {
  return results.filter(
    (r) => r.evaluation.decision === "REQUIRE_APPROVAL",
  );
}

/** Get denied actions from a batch. */
export function denied(results: BatchEvalResult[]): BatchEvalResult[] {
  return results.filter((r) => r.evaluation.decision === "DENY");
}

// ─── Re-export for backwards compat with stub API ───────────────────────────

export function loadProfile(name: string): PolicyProfile {
  return {
    name,
    rules: [],
    budgets: { max_time_ms: 300_000, max_tokens: 100_000 },
  };
}
