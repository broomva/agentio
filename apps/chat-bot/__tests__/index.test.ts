import { describe, it, expect } from "bun:test";
import { handleRequest } from "../src/server.js";

describe("chat-bot", () => {
  it("health endpoint returns ok", async () => {
    const req = new Request("http://localhost:3001/health", { method: "GET" });
    const res = await handleRequest(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.agent).toBe("chat-bot@0.1.0");
  });

  it("returns 404 for unknown routes", async () => {
    const req = new Request("http://localhost:3001/unknown", { method: "GET" });
    const res = await handleRequest(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty messages", async () => {
    const req = new Request("http://localhost:3001/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    const res = await handleRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No messages provided");
  });

  it("handles CORS preflight", async () => {
    const req = new Request("http://localhost:3001/api/chat", { method: "OPTIONS" });
    const res = await handleRequest(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("startServer is exported", async () => {
    const { startServer } = await import("../src/server.js");
    expect(typeof startServer).toBe("function");
  });
});
