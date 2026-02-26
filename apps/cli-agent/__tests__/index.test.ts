import { describe, it, expect } from "bun:test";
import { main } from "../src/index.js";

describe("cli-agent", () => {
  it("main is an exported async function", () => {
    expect(typeof main).toBe("function");
  });
});
