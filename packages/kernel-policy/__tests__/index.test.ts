import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluate, loadProfile } from "../src/index.js";

describe("kernel-policy", () => {
  it("evaluate returns ALLOW by default", () => {
    const profile = loadProfile("test");
    const decision = evaluate(profile, "file.write", "/tmp/test");
    assert.equal(decision, "ALLOW");
  });

  it("loadProfile returns a profile with the given name", () => {
    const profile = loadProfile("ci_safe");
    assert.equal(profile.name, "ci_safe");
    assert.ok(Array.isArray(profile.rules));
  });
});
