import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { connect, discoverTools, disconnect } from "../src/index.js";

describe("driver-mcp", () => {
  it("connect returns a disconnected placeholder connection", async () => {
    const conn = await connect("http://localhost:3000");
    assert.equal(conn.connected, false);
    assert.equal(conn.serverId, "placeholder");
  });

  it("discoverTools returns empty array for placeholder connection", async () => {
    const conn = await connect("http://localhost:3000");
    const tools = await discoverTools(conn);
    assert.deepEqual(tools, []);
  });
});
