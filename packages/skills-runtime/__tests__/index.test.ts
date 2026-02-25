import { describe, it, expect } from "bun:test";
import { loadSkill, listSkills, invokeSkill } from "../src/index.js";

describe("skills-runtime", () => {
  it("loadSkill returns null for unknown skills", () => {
    expect(loadSkill("nonexistent")).toBeNull();
  });

  it("listSkills returns an empty array", () => {
    expect(listSkills()).toEqual([]);
  });
});
