/**
 * @agentio/kernel-policy — Policy engine
 *
 * Evaluate policy rules against actions, enforce budgets,
 * and gate operations that require human approval.
 */

import type { PolicyProfile, PolicyRule } from "@agentio/protocol";

export type PolicyDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

/** Placeholder: evaluate an action against a policy profile */
export function evaluate(
  _profile: PolicyProfile,
  _action: string,
  _scope: string
): PolicyDecision {
  return "ALLOW";
}

/** Placeholder: load a policy profile by name */
export function loadProfile(_name: string): PolicyProfile {
  return {
    name: _name,
    rules: [],
    budgets: { max_time_ms: 300_000, max_tokens: 100_000 },
  };
}
