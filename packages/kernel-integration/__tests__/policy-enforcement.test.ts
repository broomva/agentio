import { describe, it, expect } from "bun:test";
import { evaluate, evaluateBatch, allAllowed, denied, needsApproval, buildProfile } from "@agentio/kernel-policy";
import { createTestProfile } from "../src/index.js";

describe("policy-enforcement: mirrors .control/policy.yaml", () => {
  const profile = createTestProfile();

  it("secret.log → DENY", () => {
    const result = evaluate(profile, "secret.log", "credentials");
    expect(result.decision).toBe("DENY");
  });

  it("file.write to .env → DENY", () => {
    const result = evaluate(profile, "file.write", ".env.local");
    expect(result.decision).toBe("DENY");
  });

  it("git.push to main → REQUIRE_APPROVAL", () => {
    const result = evaluate(profile, "git.push", "refs/heads/main");
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });

  it("git.force_push → REQUIRE_APPROVAL", () => {
    const result = evaluate(profile, "git.force_push", "refs/heads/feature/test");
    expect(result.decision).toBe("REQUIRE_APPROVAL");
  });

  it("file.read → ALLOW", () => {
    const result = evaluate(profile, "file.read", "src/index.ts");
    expect(result.decision).toBe("ALLOW");
  });

  it("feature branch push → ALLOW", () => {
    const result = evaluate(profile, "git.push", "refs/heads/feature/new-thing");
    expect(result.decision).toBe("ALLOW");
  });

  it("batch evaluation of typical CI workflow (all allowed)", () => {
    const actions = [
      { action: "file.read", scope: "src/index.ts" },
      { action: "file.write", scope: "packages/kernel-run/src/index.ts" },
      { action: "git.commit", scope: "refs/heads/ci" },
      { action: "exec.run", scope: "scripts/test.sh" },
    ];
    const results = evaluateBatch(profile, actions);
    expect(allAllowed(results)).toBe(true);
    expect(denied(results)).toHaveLength(0);
    expect(needsApproval(results)).toHaveLength(0);
  });

  it("batch evaluation with mixed deny/approval/allow", () => {
    const actions = [
      { action: "file.read", scope: "src/index.ts" },         // ALLOW
      { action: "secret.log", scope: "api_key" },             // DENY
      { action: "git.push", scope: "refs/heads/main" },       // REQUIRE_APPROVAL
      { action: "git.push", scope: "refs/heads/feature/ok" }, // ALLOW
    ];
    const results = evaluateBatch(profile, actions);

    expect(allAllowed(results)).toBe(false);
    expect(denied(results)).toHaveLength(1);
    expect(denied(results)[0].action).toBe("secret.log");
    expect(needsApproval(results)).toHaveLength(1);
    expect(needsApproval(results)[0].action).toBe("git.push");
    expect(needsApproval(results)[0].scope).toBe("refs/heads/main");
  });

  it("default deny for unmatched actions", () => {
    const result = evaluate(profile, "unknown.action", "anywhere");
    expect(result.decision).toBe("DENY");
    expect(result.reason).toContain("No rule matches");
  });

  it("buildProfile respects priority: deny > approval > allow", () => {
    const customProfile = buildProfile({
      name: "test-priority",
      denied: [{ action: "file.write", scope: ".env*", reason: "no env" }],
      approval_required: [{ action: "git.push", scope: "refs/heads/main" }],
      allowed: [{ action: "file.write", scope: "**/*" }],
    });

    // .env should match deny first even though a broader allow exists
    expect(evaluate(customProfile, "file.write", ".env").decision).toBe("DENY");
    // Normal file.write should be allowed
    expect(evaluate(customProfile, "file.write", "src/foo.ts").decision).toBe("ALLOW");
    // Main push requires approval
    expect(evaluate(customProfile, "git.push", "refs/heads/main").decision).toBe("REQUIRE_APPROVAL");
  });
});
