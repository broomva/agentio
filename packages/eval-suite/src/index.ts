/**
 * @agentio/eval-suite — Evaluation suite
 *
 * Benchmark, score, and regression-test agent runs.
 * Provides a framework for measuring agent quality and performance.
 */

import type { RunSummary } from "@agentio/protocol";

export interface EvalCase {
  id: string;
  objective: string;
  expectedOutcome: string;
  maxDurationMs: number;
}

export interface EvalResult {
  caseId: string;
  passed: boolean;
  score: number;
  summary: RunSummary | null;
  notes: string;
}

/** Placeholder: run an evaluation case */
export async function runEval(_evalCase: EvalCase): Promise<EvalResult> {
  return {
    caseId: _evalCase.id,
    passed: false,
    score: 0,
    summary: null,
    notes: "not implemented",
  };
}

/** Placeholder: run a full evaluation suite */
export async function runSuite(_cases: EvalCase[]): Promise<EvalResult[]> {
  return Promise.all(_cases.map(runEval));
}
