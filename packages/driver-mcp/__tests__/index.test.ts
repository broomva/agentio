import { describe, it, expect } from "bun:test";
import { connect, discoverTools, disconnect } from "../src/index.js";

describe("driver-mcp", () => {
  it("connect returns a disconnected placeholder connection", async () => {
    const conn = await connect("http://localhost:3000");
    expect(conn.connected).toBe(false);
    expect(conn.serverId).toBe("placeholder");
  });

  it("discoverTools returns empty array for placeholder connection", async () => {
    const conn = await connect("http://localhost:3000");
    const tools = await discoverTools(conn);
    expect(tools).toEqual([]);
  });
});
