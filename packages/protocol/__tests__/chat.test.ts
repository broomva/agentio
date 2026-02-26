import { describe, it, expect } from "bun:test";
import {
  emptyUsage,
  idleStreamState,
  validateChatMessage,
  validateUsageSnapshot,
  CHAT_ROLES,
  STREAM_PHASES,
  FINISH_REASONS,
} from "../src/index.js";
import type {
  ChatMessage,
  UsageSnapshot,
  StreamState,
  StepRecord,
  ToolInvocation,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "../src/index.js";

describe("chat types", () => {
  describe("constants", () => {
    it("CHAT_ROLES has 4 entries", () => {
      expect(CHAT_ROLES).toEqual(["system", "user", "assistant", "tool"]);
    });

    it("STREAM_PHASES has 6 entries", () => {
      expect(STREAM_PHASES).toHaveLength(6);
    });

    it("FINISH_REASONS has 5 entries", () => {
      expect(FINISH_REASONS).toEqual([
        "stop",
        "tool-calls",
        "length",
        "content-filter",
        "error",
      ]);
    });
  });

  describe("emptyUsage", () => {
    it("returns zeroed UsageSnapshot", () => {
      const u = emptyUsage();
      expect(u.input_tokens).toBe(0);
      expect(u.output_tokens).toBe(0);
      expect(u.total_tokens).toBe(0);
      expect(u.reasoning_tokens).toBeUndefined();
      expect(u.cached_input_tokens).toBeUndefined();
    });
  });

  describe("idleStreamState", () => {
    it("returns idle StreamState", () => {
      const s = idleStreamState();
      expect(s.phase).toBe("idle");
      expect(s.step_index).toBe(0);
      expect(s.partial_text).toBe("");
      expect(s.pending_tool_calls).toEqual([]);
      expect(s.completed_invocations).toEqual([]);
      expect(s.cumulative_usage.total_tokens).toBe(0);
      expect(s.error).toBeUndefined();
    });
  });

  describe("validateChatMessage", () => {
    it("accepts a valid string-content message", () => {
      const msg: ChatMessage = { role: "user", content: "Hello" };
      expect(validateChatMessage(msg)).toEqual({ valid: true });
    });

    it("accepts a valid array-content message", () => {
      const parts: TextPart[] = [{ type: "text", text: "Hi" }];
      const msg: ChatMessage = { role: "assistant", content: parts };
      expect(validateChatMessage(msg)).toEqual({ valid: true });
    });

    it("rejects invalid role", () => {
      const result = validateChatMessage({ role: "bot", content: "x" });
      expect(result.valid).toBe(false);
    });

    it("rejects missing content", () => {
      const result = validateChatMessage({ role: "user" });
      expect(result.valid).toBe(false);
    });

    it("rejects non-object", () => {
      const result = validateChatMessage("not an object");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateUsageSnapshot", () => {
    it("accepts a valid snapshot", () => {
      const u: UsageSnapshot = {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      };
      expect(validateUsageSnapshot(u)).toEqual({ valid: true });
    });

    it("rejects negative tokens", () => {
      const result = validateUsageSnapshot({
        input_tokens: -1,
        output_tokens: 0,
        total_tokens: 0,
      });
      expect(result.valid).toBe(false);
    });

    it("rejects missing fields", () => {
      const result = validateUsageSnapshot({ input_tokens: 10 });
      expect(result.valid).toBe(false);
    });
  });

  describe("ChatPart discriminated union", () => {
    it("TextPart has type text", () => {
      const part: TextPart = { type: "text", text: "hello" };
      expect(part.type).toBe("text");
    });

    it("ToolCallPart has type tool-call", () => {
      const part: ToolCallPart = {
        type: "tool-call",
        tool_call_id: "tc-1",
        tool_name: "search",
        args: { query: "test" },
      };
      expect(part.type).toBe("tool-call");
    });

    it("ToolResultPart has type tool-result", () => {
      const part: ToolResultPart = {
        type: "tool-result",
        tool_call_id: "tc-1",
        tool_name: "search",
        result: { data: [] },
      };
      expect(part.type).toBe("tool-result");
    });
  });

  describe("ToolInvocation", () => {
    it("round-trips through JSON", () => {
      const inv: ToolInvocation = {
        tool_call_id: "tc-1",
        tool_name: "query_state",
        args: { key: "agent" },
        result: { mode: "idle" },
        is_error: false,
        duration_ms: 42,
        step_index: 0,
      };
      const parsed = JSON.parse(JSON.stringify(inv)) as ToolInvocation;
      expect(parsed.tool_call_id).toBe("tc-1");
      expect(parsed.is_error).toBe(false);
      expect(parsed.duration_ms).toBe(42);
    });
  });

  describe("StepRecord", () => {
    it("can represent a complete step", () => {
      const step: StepRecord = {
        step_index: 0,
        messages_in: [{ role: "user", content: "Hello" }],
        message_out: { role: "assistant", content: "Hi there!" },
        tool_invocations: [],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        finish_reason: "stop",
        duration_ms: 200,
      };
      expect(step.finish_reason).toBe("stop");
      expect(step.tool_invocations).toHaveLength(0);
    });
  });
});

describe("new event types", () => {
  it("EVENT_TYPES includes llm events", () => {
    const { EVENT_TYPES } = require("../src/index.js");
    expect(EVENT_TYPES).toContain("llm.step_completed");
    expect(EVENT_TYPES).toContain("llm.usage");
  });
});
