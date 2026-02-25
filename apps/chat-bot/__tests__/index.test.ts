import { describe, it, expect } from "bun:test";
import { handleMessage } from "../src/index.js";
import type { ChatMessage } from "../src/index.js";

describe("chat-bot", () => {
  it("handleMessage returns an assistant response", async () => {
    const msg: ChatMessage = {
      role: "user",
      content: "hello",
      timestamp: new Date().toISOString(),
    };
    const reply = await handleMessage(msg);
    expect(reply.role).toBe("assistant");
    expect(reply.content).toBeTruthy();
  });
});
