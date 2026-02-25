/**
 * @agentio/chat-bot — Chat bot
 *
 * Conversational agent interface for messaging platforms.
 * Translates chat messages into agent runs and streams results back.
 */

import { createAgent, startRun, shutdown } from "@agentio/agent-runtime";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

/** Placeholder: handle an incoming chat message */
export async function handleMessage(_message: ChatMessage): Promise<ChatMessage> {
  return {
    role: "assistant",
    content: "Not yet implemented.",
    timestamp: new Date().toISOString(),
  };
}

/** Placeholder: start the chat bot server */
export async function startServer(_port: number): Promise<void> {
  console.log(`agentio chat-bot v0.1.0 listening on port ${_port}`);
  // TODO: implement chat server
}
