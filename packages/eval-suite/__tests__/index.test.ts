import { describe, it, expect } from "bun:test";
import { runEval, runSuite } from "../src/index.js";
import type { EvalCase } from "../src/index.js";

describe("eval-suite", () => {
  it("runEval returns a failing result for unimplemented case", async () => {
    const evalCase: EvalCase = {
      id: "test-001",
      objective: "test objective",
      expectedOutcome: "success",
      maxDurationMs: 5000,
    };
    const result = await runEval(evalCase);
    expect(result.caseId).toBe("test-001");
    expect(result.passed).toBe(false);
    expect(result.notes).toBe("not implemented");
  });

  it("runSuite processes all cases", async () => {
    const cases: EvalCase[] = [
      { id: "a", objective: "obj-a", expectedOutcome: "pass", maxDurationMs: 1000 },
      { id: "b", objective: "obj-b", expectedOutcome: "pass", maxDurationMs: 1000 },
    ];
    const results = await runSuite(cases);
    expect(results).toHaveLength(2);
  });
});
