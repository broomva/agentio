import { describe, it, expect } from "bun:test";
import {
  matchesScope,
  findMatchingRule,
  evaluate,
  checkBudget,
  buildProfile,
  evaluateBatch,
  allAllowed,
  needsApproval,
  denied,
  loadProfile,
} from "../src/index.js";
import type { PolicyProfile, PolicyRule } from "@agentio/protocol";

// ─── matchesScope ───────────────────────────────────────────────────────────

describe("matchesScope", () => {
  it("matches exact scope", () => {
    expect(matchesScope("refs/heads/main", "refs/heads/main")).toBe(true);
  });

  it("matches wildcard *", () => {
    expect(matchesScope("*", "anything")).toBe(true);
  });

  it("matches glob * within path segment", () => {
    expect(matchesScope("refs/heads/*", "refs/heads/feature/foo")).toBe(false);
    expect(matchesScope("refs/heads/*", "refs/heads/main")).toBe(true);
  });

  it("matches globstar **", () => {
    expect(matchesScope("packages/**", "packages/protocol/src/index.ts")).toBe(
      true,
    );
    expect(matchesScope("packages/**/*.ts", "packages/kernel/src/foo.ts")).toBe(
      true,
    );
  });

  it("rejects non-matching scope", () => {
    expect(matchesScope("refs/heads/main", "refs/heads/develop")).toBe(false);
    expect(matchesScope("packages/**", "apps/cli/index.ts")).toBe(false);
  });
});

// ─── findMatchingRule ───────────────────────────────────────────────────────

describe("findMatchingRule", () => {
  const rules: PolicyRule[] = [
    { action: "git.push", scope: "refs/heads/main", decision: "REQUIRE_APPROVAL" },
    { action: "file.read", scope: "**/*", decision: "ALLOW" },
    { action: "secret.log", scope: "*", decision: "DENY" },
  ];

  it("finds exact match", () => {
    const rule = findMatchingRule(rules, "git.push", "refs/heads/main");
    expect(rule).not.toBeNull();
    expect(rule!.decision).toBe("REQUIRE_APPROVAL");
  });

  it("finds glob match", () => {
    const rule = findMatchingRule(rules, "file.read", "src/index.ts");
    expect(rule).not.toBeNull();
    expect(rule!.decision).toBe("ALLOW");
  });

  it("returns null when no match", () => {
    const rule = findMatchingRule(rules, "deploy.prod", "us-east-1");
    expect(rule).toBeNull();
  });
});

// ─── evaluate ───────────────────────────────────────────────────────────────

describe("evaluate", () => {
  const profile = buildProfile({
    name: "ci_safe",
    denied: [{ action: "secret.log", scope: "*", reason: "Never log secrets" }],
    approval_required: [
      {
        action: "git.push",
        scope: "refs/heads/main",
        reason: "Main branch requires review",
      },
    ],
    allowed: [
      { action: "file.read", scope: "**/*" },
      { action: "git.push", scope: "refs/heads/feature/*" },
    ],
  });

  it("denies matching denied rule", () => {
    const result = evaluate(profile, "secret.log", "password");
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("Never log secrets");
  });

  it("requires approval for matching approval rule", () => {
    const result = evaluate(profile, "git.push", "refs/heads/main");
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });

  it("allows matching allowed rule", () => {
    const result = evaluate(profile, "file.read", "src/index.ts");
    expect(result.decision).toBe("ALLOW");
  });

  it("allows feature branch push", () => {
    const result = evaluate(profile, "git.push", "refs/heads/feature/foo");
    expect(result.decision).toBe("ALLOW");
  });

  it("denies unmatched action by default", () => {
    const result = evaluate(profile, "deploy.nuke", "production");
    expect(result.decision).toBe("DENY");
    expect(result.reason).toContain("No rule matches");
  });

  it("includes timestamp", () => {
    const result = evaluate(profile, "file.read", "any");
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

// ─── checkBudget ────────────────────────────────────────────────────────────

describe("checkBudget", () => {
  const budgets = {
    max_time_ms: 60_000,
    max_tokens: 10_000,
    max_tool_calls: 100,
    max_artifacts_mb: 50,
  };

  it("passes when within budget", () => {
    const result = checkBudget(budgets, {
      elapsed_ms: 30_000,
      tokens_used: 5_000,
      tool_calls: 50,
      artifacts_mb: 25,
    });
    expect(result.within_budget).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("fails when time exceeded", () => {
    const result = checkBudget(budgets, {
      elapsed_ms: 120_000,
      tokens_used: 0,
      tool_calls: 0,
      artifacts_mb: 0,
    });
    expect(result.within_budget).toBe(false);
    expect(result.violations[0]).toContain("Time budget exceeded");
  });

  it("reports multiple violations", () => {
    const result = checkBudget(budgets, {
      elapsed_ms: 120_000,
      tokens_used: 20_000,
      tool_calls: 200,
      artifacts_mb: 100,
    });
    expect(result.violations).toHaveLength(4);
  });

  it("ignores optional budgets when undefined", () => {
    const minBudgets = { max_time_ms: 60_000, max_tokens: 10_000 };
    const result = checkBudget(minBudgets, {
      elapsed_ms: 30_000,
      tokens_used: 5_000,
      tool_calls: 999,
      artifacts_mb: 999,
    });
    expect(result.within_budget).toBe(true);
  });
});

// ─── buildProfile ───────────────────────────────────────────────────────────

describe("buildProfile", () => {
  it("builds profile with correct rule ordering", () => {
    const profile = buildProfile({
      name: "test",
      denied: [{ action: "a", scope: "*" }],
      approval_required: [{ action: "b", scope: "*" }],
      allowed: [{ action: "c", scope: "*" }],
    });
    expect(profile.rules[0].decision).toBe("DENY");
    expect(profile.rules[1].decision).toBe("REQUIRE_APPROVAL");
    expect(profile.rules[2].decision).toBe("ALLOW");
  });

  it("uses default budgets when not specified", () => {
    const profile = buildProfile({ name: "default" });
    expect(profile.budgets.max_time_ms).toBe(3_600_000);
    expect(profile.budgets.max_tokens).toBe(100_000);
  });

  it("respects custom budgets", () => {
    const profile = buildProfile({
      name: "custom",
      budgets: { max_time_ms: 1000, max_tokens: 500 },
    });
    expect(profile.budgets.max_time_ms).toBe(1000);
    expect(profile.budgets.max_tokens).toBe(500);
  });
});

// ─── evaluateBatch ──────────────────────────────────────────────────────────

describe("evaluateBatch", () => {
  const profile = buildProfile({
    name: "batch_test",
    denied: [{ action: "secret.log", scope: "*" }],
    allowed: [{ action: "file.read", scope: "**/*" }],
  });

  it("evaluates multiple actions", () => {
    const results = evaluateBatch(profile, [
      { action: "file.read", scope: "src/index.ts" },
      { action: "secret.log", scope: "token" },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].evaluation.decision).toBe("ALLOW");
    expect(results[1].evaluation.decision).toBe("DENY");
  });

  it("allAllowed returns false when any denied", () => {
    const results = evaluateBatch(profile, [
      { action: "file.read", scope: "src/a.ts" },
      { action: "secret.log", scope: "b" },
    ]);
    expect(allAllowed(results)).toBe(false);
  });

  it("allAllowed returns true when all allowed", () => {
    const results = evaluateBatch(profile, [
      { action: "file.read", scope: "src/a.ts" },
      { action: "file.read", scope: "src/b.ts" },
    ]);
    expect(allAllowed(results)).toBe(true);
  });

  it("needsApproval filters correctly", () => {
    const p = buildProfile({
      name: "mixed",
      approval_required: [{ action: "git.push", scope: "*" }],
      allowed: [{ action: "file.read", scope: "*" }],
    });
    const results = evaluateBatch(p, [
      { action: "file.read", scope: "a" },
      { action: "git.push", scope: "main" },
    ]);
    expect(needsApproval(results)).toHaveLength(1);
    expect(needsApproval(results)[0].action).toBe("git.push");
  });
});

// ─── loadProfile (backwards compat) ─────────────────────────────────────────

describe("loadProfile", () => {
  it("returns an empty profile", () => {
    const profile = loadProfile("ci_safe");
    expect(profile.name).toBe("ci_safe");
    expect(profile.rules).toEqual([]);
  });
});
