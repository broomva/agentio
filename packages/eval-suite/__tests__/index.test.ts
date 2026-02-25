import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    assert.equal(result.caseId, "test-001");
    assert.equal(result.passed, false);
    assert.equal(result.notes, "not implemented");
  });

  it("runSuite processes all cases", async () => {
    const cases: EvalCase[] = [
      { id: "a", objective: "obj-a", expectedOutcome: "pass", maxDurationMs: 1000 },
      { id: "b", objective: "obj-b", expectedOutcome: "pass", maxDurationMs: 1000 },
    ];
    const results = await runSuite(cases);
    assert.equal(results.length, 2);
  });
});
