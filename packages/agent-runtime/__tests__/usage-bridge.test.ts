import { describe, it, expect } from "bun:test";
import { toUsageSnapshot, accumulateUsage, toBudgetUsage } from "../src/usage-bridge.js";
import type { LanguageModelUsage } from "ai";

describe("usage-bridge", () => {
  describe("toUsageSnapshot", () => {
    it("maps AI SDK usage fields to snake_case", () => {
      const aiUsage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: 20,
          cacheWriteTokens: undefined,
        },
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: 10,
        },
      };
      const snapshot = toUsageSnapshot(aiUsage);
      expect(snapshot.input_tokens).toBe(100);
      expect(snapshot.output_tokens).toBe(50);
      expect(snapshot.total_tokens).toBe(150);
      expect(snapshot.reasoning_tokens).toBe(10);
      expect(snapshot.cached_input_tokens).toBe(20);
    });

    it("handles undefined token counts", () => {
      const aiUsage: LanguageModelUsage = {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
      };
      const snapshot = toUsageSnapshot(aiUsage);
      expect(snapshot.input_tokens).toBe(0);
      expect(snapshot.output_tokens).toBe(0);
      expect(snapshot.total_tokens).toBe(0);
      expect(snapshot.reasoning_tokens).toBeUndefined();
    });
  });

  describe("accumulateUsage", () => {
    it("sums multiple snapshots", () => {
      const snapshots = [
        { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      ];
      const acc = accumulateUsage(snapshots);
      expect(acc.input_tokens).toBe(30);
      expect(acc.output_tokens).toBe(15);
      expect(acc.total_tokens).toBe(45);
    });

    it("returns empty usage for empty array", () => {
      const acc = accumulateUsage([]);
      expect(acc.total_tokens).toBe(0);
    });

    it("accumulates optional fields", () => {
      const snapshots = [
        { input_tokens: 10, output_tokens: 5, total_tokens: 15, reasoning_tokens: 3 },
        { input_tokens: 10, output_tokens: 5, total_tokens: 15, reasoning_tokens: 2 },
      ];
      const acc = accumulateUsage(snapshots);
      expect(acc.reasoning_tokens).toBe(5);
    });
  });

  describe("toBudgetUsage", () => {
    it("maps to kernel-policy BudgetUsage", () => {
      const usage = { input_tokens: 100, output_tokens: 50, total_tokens: 150 };
      const budget = toBudgetUsage(usage, 5000, 3, 1.5);
      expect(budget.elapsed_ms).toBe(5000);
      expect(budget.tokens_used).toBe(150);
      expect(budget.tool_calls).toBe(3);
      expect(budget.artifacts_mb).toBe(1.5);
    });
  });
});
