import { describe, it, expect } from "bun:test";
import {
  toAiSdkMessages,
  fromAiSdkAssistantContent,
  extractText,
} from "../src/message-bridge.js";
import type { ChatMessage } from "@agentio/protocol";

describe("message-bridge", () => {
  describe("toAiSdkMessages", () => {
    it("converts a system message", () => {
      const msgs: ChatMessage[] = [
        { role: "system", content: "You are helpful." },
      ];
      const result = toAiSdkMessages(msgs);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("system");
      expect((result[0] as any).content).toBe("You are helpful.");
    });

    it("converts a user message with string content", () => {
      const msgs: ChatMessage[] = [{ role: "user", content: "Hello" }];
      const result = toAiSdkMessages(msgs);
      expect(result[0].role).toBe("user");
      expect((result[0] as any).content).toEqual([
        { type: "text", text: "Hello" },
      ]);
    });

    it("converts an assistant message with tool calls", () => {
      const msgs: ChatMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check." },
            {
              type: "tool-call",
              tool_call_id: "tc-1",
              tool_name: "search",
              args: { q: "test" },
            },
          ],
        },
      ];
      const result = toAiSdkMessages(msgs);
      expect(result[0].role).toBe("assistant");
      const content = (result[0] as any).content;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: "text", text: "Let me check." });
      expect(content[1]).toEqual({
        type: "tool-call",
        toolCallId: "tc-1",
        toolName: "search",
        input: { q: "test" }, // AI SDK v6 uses `input` not `args`
      });
    });

    it("converts a tool result message", () => {
      const msgs: ChatMessage[] = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              tool_call_id: "tc-1",
              tool_name: "search",
              result: { data: "found" },
            },
          ],
        },
      ];
      const result = toAiSdkMessages(msgs);
      expect(result[0].role).toBe("tool");
      const content = (result[0] as any).content;
      expect(content[0].toolCallId).toBe("tc-1");
      expect(content[0].toolName).toBe("search");
      // AI SDK v6 wraps result as { type: "json", value: ... }
      expect(content[0].output).toEqual({ type: "json", value: { data: "found" } });
    });
  });

  describe("fromAiSdkAssistantContent", () => {
    it("converts text content", () => {
      const content = [{ type: "text" as const, text: "Hello!" }];
      const msg = fromAiSdkAssistantContent(content);
      expect(msg.role).toBe("assistant");
      expect(msg.content).toEqual([{ type: "text", text: "Hello!" }]);
    });

    it("converts tool call content", () => {
      const content = [
        {
          type: "tool-call" as const,
          toolCallId: "tc-1",
          toolName: "search",
          args: { q: "test" },
        },
      ];
      const msg = fromAiSdkAssistantContent(content);
      const parts = msg.content as any[];
      expect(parts[0].type).toBe("tool-call");
      expect(parts[0].tool_call_id).toBe("tc-1");
      expect(parts[0].tool_name).toBe("search");
    });
  });

  describe("extractText", () => {
    it("extracts text from content array", () => {
      const content = [
        { type: "text", text: "Hello " },
        { type: "tool-call" },
        { type: "text", text: "world" },
      ];
      expect(extractText(content)).toBe("Hello world");
    });

    it("returns empty string for no text parts", () => {
      expect(extractText([{ type: "tool-call" }])).toBe("");
    });
  });
});
