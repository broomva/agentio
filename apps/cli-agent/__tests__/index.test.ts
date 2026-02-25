import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { main } from "../src/index.js";

describe("cli-agent", () => {
  it("main is a function", () => {
    assert.equal(typeof main, "function");
  });
});
