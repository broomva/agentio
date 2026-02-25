import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { store, metadata, retrieve } from "../src/index.js";

describe("kernel-artifact", () => {
  it("store returns an artifact handle", () => {
    const handle = store(new Uint8Array([1, 2, 3]), "application/octet-stream");
    assert.ok(handle.startsWith("artifact://"));
  });

  it("metadata returns null for unknown handles", () => {
    const result = metadata("artifact://sha256/unknown" as any);
    assert.equal(result, null);
  });

  it("retrieve returns null for unknown handles", () => {
    const result = retrieve("artifact://sha256/unknown" as any);
    assert.equal(result, null);
  });
});
