/**
 * Mock model for deterministic testing without API keys.
 *
 * Uses AI SDK's built-in MockLanguageModelV3 from 'ai/test'.
 */

import { MockLanguageModelV3, mockValues, simulateReadableStream } from "ai/test";
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";

/** Create a mock model that returns a fixed text response. */
export function createTextMockModel(text: string) {
  return new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text }],
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 5 },
      warnings: [],
    },
    doStream: {
      stream: simulateReadableStream<LanguageModelV3StreamPart>({
        chunks: [
          { type: "text-start" },
          { type: "text-delta", textDelta: text },
          {
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 5 },
          },
        ],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    },
  });
}

/** Create a mock model that makes a tool call. */
export function createToolCallMockModel(
  toolName: string,
  args: Record<string, unknown>,
  toolCallId = "mock-tc-1",
) {
  return new MockLanguageModelV3({
    doGenerate: mockValues(
      {
        content: [
          { type: "tool-call", toolCallId, toolName, args },
        ],
        finishReason: "tool-calls" as const,
        usage: { inputTokens: 15, outputTokens: 8 },
        warnings: [],
      },
      {
        content: [{ type: "text", text: "Done using the tool." }],
        finishReason: "stop" as const,
        usage: { inputTokens: 20, outputTokens: 10 },
        warnings: [],
      },
    ),
    doStream: {
      stream: simulateReadableStream<LanguageModelV3StreamPart>({
        chunks: [
          {
            type: "tool-call",
            toolCallType: "function",
            toolCallId,
            toolName,
            args: JSON.stringify(args),
          },
          {
            type: "finish",
            finishReason: "tool-calls",
            usage: { inputTokens: 15, outputTokens: 8 },
          },
        ],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    },
  });
}
