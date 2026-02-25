import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    assert.equal(reply.role, "assistant");
    assert.ok(reply.content);
  });
});
