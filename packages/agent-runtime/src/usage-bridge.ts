/**
 * Usage bridge — maps between AI SDK LanguageModelUsage and agentio UsageSnapshot.
 */

import type { UsageSnapshot } from "@agentio/protocol";
import { emptyUsage } from "@agentio/protocol";
import type { LanguageModelUsage } from "ai";
import type { BudgetUsage } from "@agentio/kernel-policy";

/** Convert AI SDK LanguageModelUsage → agentio UsageSnapshot. */
export function toUsageSnapshot(aiUsage: LanguageModelUsage): UsageSnapshot {
  return {
    input_tokens: aiUsage.inputTokens ?? 0,
    output_tokens: aiUsage.outputTokens ?? 0,
    total_tokens: aiUsage.totalTokens ?? 0,
    reasoning_tokens: aiUsage.outputTokenDetails?.reasoningTokens ?? undefined,
    cached_input_tokens: aiUsage.inputTokenDetails?.cacheReadTokens ?? undefined,
  };
}

/** Sum multiple UsageSnapshots into one cumulative snapshot. */
export function accumulateUsage(snapshots: UsageSnapshot[]): UsageSnapshot {
  if (snapshots.length === 0) return emptyUsage();
  return snapshots.reduce(
    (acc, s) => ({
      input_tokens: acc.input_tokens + s.input_tokens,
      output_tokens: acc.output_tokens + s.output_tokens,
      total_tokens: acc.total_tokens + s.total_tokens,
      reasoning_tokens:
        s.reasoning_tokens !== undefined
          ? (acc.reasoning_tokens ?? 0) + s.reasoning_tokens
          : acc.reasoning_tokens,
      cached_input_tokens:
        s.cached_input_tokens !== undefined
          ? (acc.cached_input_tokens ?? 0) + s.cached_input_tokens
          : acc.cached_input_tokens,
    }),
    emptyUsage(),
  );
}

/** Convert UsageSnapshot + runtime metrics → kernel-policy BudgetUsage. */
export function toBudgetUsage(
  usage: UsageSnapshot,
  elapsed_ms: number,
  tool_calls: number,
  artifacts_mb: number,
): BudgetUsage {
  return {
    elapsed_ms,
    tokens_used: usage.total_tokens,
    tool_calls,
    artifacts_mb,
  };
}
