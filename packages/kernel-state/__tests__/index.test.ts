import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initState, snapshot } from "../src/index.js";

describe("kernel-state", () => {
  it("initState returns empty state", () => {
    const state = initState();
    assert.equal(state.activeRuns.size, 0);
    assert.equal(state.completedRuns.size, 0);
    assert.equal(state.artifacts.size, 0);
  });

  it("snapshot reports zero counts for fresh state", () => {
    const state = initState();
    const snap = snapshot(state);
    assert.equal(snap.activeRunCount, 0);
    assert.equal(snap.completedRunCount, 0);
    assert.equal(snap.artifactCount, 0);
  });
});
