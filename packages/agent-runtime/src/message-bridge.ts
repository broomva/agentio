/**
 * Message bridge — converts between agentio ChatMessage (snake_case) and AI SDK ModelMessage (camelCase).
 *
 * AI SDK v6 property names:
 *   ToolCallPart: { type: "tool-call", toolCallId, toolName, input }
 *   ToolResultPart: { type: "tool-result", toolCallId, toolName, output }
 */

import type { ChatMessage, ChatPart, ToolCallPart as AgentioToolCallPart, ToolResultPart as AgentioToolResultPart } from "@agentio/protocol";
import type { TextPart as AgentioTextPart } from "@agentio/protocol";
import type {
  ModelMessage,
  SystemModelMessage,
  UserModelMessage,
  AssistantModelMessage,
  ToolModelMessage,
} from "ai";

/** Convert agentio ChatMessage[] → AI SDK ModelMessage[]. */
export function toAiSdkMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map(toAiSdkMessage);
}

function toAiSdkMessage(msg: ChatMessage): ModelMessage {
  switch (msg.role) {
    case "system": {
      const systemMsg: SystemModelMessage = {
        role: "system",
        content: typeof msg.content === "string" ? msg.content : partsToText(msg.content),
      };
      return systemMsg;
    }

    case "user": {
      const userMsg: UserModelMessage = {
        role: "user",
        content: typeof msg.content === "string"
          ? [{ type: "text" as const, text: msg.content }]
          : msg.content
              .filter((p): p is AgentioTextPart => p.type === "text")
              .map((p) => ({ type: "text" as const, text: p.text })),
      };
      return userMsg;
    }

    case "assistant": {
      const content: AssistantModelMessage["content"] = [];

      if (typeof msg.content === "string") {
        content.push({ type: "text" as const, text: msg.content });
      } else {
        for (const part of msg.content) {
          if (part.type === "text") {
            content.push({ type: "text" as const, text: part.text });
          } else if (part.type === "tool-call") {
            content.push({
              type: "tool-call" as const,
              toolCallId: part.tool_call_id,
              toolName: part.tool_name,
              input: part.args, // AI SDK v6 uses `input` not `args`
            });
          }
        }
      }
      const assistantMsg: AssistantModelMessage = { role: "assistant", content };
      return assistantMsg;
    }

    case "tool": {
      const parts = typeof msg.content === "string"
        ? [] as AgentioToolResultPart[]
        : msg.content.filter((p): p is AgentioToolResultPart => p.type === "tool-result");

      const toolMsg: ToolModelMessage = {
        role: "tool",
        content: parts.map((p) => ({
          type: "tool-result" as const,
          toolCallId: p.tool_call_id,
          toolName: p.tool_name,
          // AI SDK v6 ToolResultOutput is a discriminated union
          output: p.is_error
            ? { type: "error-text" as const, value: String(p.result) }
            : { type: "json" as const, value: p.result as any },
        })),
      };
      return toolMsg;
    }
  }
}

/** Convert AI SDK assistant response content → agentio ChatMessage. */
export function fromAiSdkAssistantContent(
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool-call"; toolCallId: string; toolName: string; input?: unknown; args?: unknown }
  >,
): ChatMessage {
  const parts: ChatPart[] = content.map((c) => {
    if (c.type === "text") {
      return { type: "text", text: c.text } as AgentioTextPart;
    }
    return {
      type: "tool-call",
      tool_call_id: c.toolCallId,
      tool_name: c.toolName,
      args: c.input ?? c.args ?? {},
    } as AgentioToolCallPart;
  });

  return { role: "assistant", content: parts };
}

/** Extract plain text from an assistant content array. */
export function extractText(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("");
}

function partsToText(parts: ChatPart[]): string {
  return parts
    .filter((p): p is AgentioTextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}
