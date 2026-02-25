import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadSkill, listSkills, invokeSkill } from "../src/index.js";

describe("skills-runtime", () => {
  it("loadSkill returns null for unknown skills", () => {
    assert.equal(loadSkill("nonexistent"), null);
  });

  it("listSkills returns an empty array", () => {
    assert.deepEqual(listSkills(), []);
  });
});
