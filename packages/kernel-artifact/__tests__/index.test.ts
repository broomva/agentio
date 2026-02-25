import { describe, it, expect, beforeEach } from "bun:test";
import {
  ArtifactStore,
  MemoryBackend,
  sha256,
  sha256String,
  extractHash,
} from "../src/index.js";
import type { ArtifactHandle } from "@agentio/protocol";

const encoder = new TextEncoder();

// ─── sha256 ─────────────────────────────────────────────────────────────────

describe("sha256", () => {
  it("produces a 64-char hex string", async () => {
    const hash = await sha256(encoder.encode("hello"));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", async () => {
    const a = await sha256(encoder.encode("test"));
    const b = await sha256(encoder.encode("test"));
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await sha256(encoder.encode("hello"));
    const b = await sha256(encoder.encode("world"));
    expect(a).not.toBe(b);
  });
});

describe("sha256String", () => {
  it("hashes a string", async () => {
    const hash = await sha256String("hello");
    const direct = await sha256(encoder.encode("hello"));
    expect(hash).toBe(direct);
  });
});

// ─── extractHash ────────────────────────────────────────────────────────────

describe("extractHash", () => {
  it("extracts hash from standard handle", () => {
    const handle = "artifact://sha256/abc123" as ArtifactHandle;
    expect(extractHash(handle)).toBe("abc123");
  });

  it("returns null for non-artifact URI", () => {
    expect(extractHash("file:///tmp/test" as ArtifactHandle)).toBeNull();
  });
});

// ─── MemoryBackend ──────────────────────────────────────────────────────────

describe("MemoryBackend", () => {
  let backend: MemoryBackend;

  beforeEach(() => {
    backend = new MemoryBackend();
  });

  it("put and get", async () => {
    const data = encoder.encode("hello");
    await backend.put("abc", data);
    const result = await backend.get("abc");
    expect(result).toEqual(data);
  });

  it("returns null for missing key", async () => {
    expect(await backend.get("missing")).toBeNull();
  });

  it("has returns correct boolean", async () => {
    await backend.put("key", encoder.encode("val"));
    expect(await backend.has("key")).toBe(true);
    expect(await backend.has("nope")).toBe(false);
  });

  it("delete removes entry", async () => {
    await backend.put("key", encoder.encode("val"));
    expect(await backend.delete("key")).toBe(true);
    expect(await backend.has("key")).toBe(false);
    expect(await backend.delete("key")).toBe(false);
  });

  it("tracks size", async () => {
    expect(backend.size).toBe(0);
    await backend.put("a", encoder.encode("1"));
    expect(backend.size).toBe(1);
    backend.clear();
    expect(backend.size).toBe(0);
  });
});

// ─── ArtifactStore ──────────────────────────────────────────────────────────

describe("ArtifactStore", () => {
  let store: ArtifactStore;

  beforeEach(() => {
    store = new ArtifactStore();
  });

  it("stores and retrieves data", async () => {
    const data = encoder.encode("hello world");
    const handle = await store.store(data, "text/plain", "run-1");

    expect(handle).toMatch(/^artifact:\/\/sha256\/[0-9a-f]{64}$/);

    const retrieved = await store.retrieve(handle);
    expect(retrieved).toEqual(data);
  });

  it("stores and retrieves strings", async () => {
    const handle = await store.storeString(
      "console.log('hi')",
      "text/javascript",
      "run-1",
    );

    const text = await store.retrieveString(handle);
    expect(text).toBe("console.log('hi')");
  });

  it("deduplicates identical content", async () => {
    const data = encoder.encode("same content");
    const h1 = await store.store(data, "text/plain", "run-1");
    const h2 = await store.store(data, "text/plain", "run-2");

    // Same content → same handle
    expect(h1).toBe(h2);
  });

  it("tracks metadata", async () => {
    const data = encoder.encode("metadata test");
    const handle = await store.store(data, "application/json", "run-meta");

    const meta = store.getMetadata(handle);
    expect(meta).not.toBeNull();
    expect(meta!.handle).toBe(handle);
    expect(meta!.size).toBe(data.byteLength);
    expect(meta!.mime).toBe("application/json");
    expect(meta!.run_id).toBe("run-meta");
    expect(meta!.created_at).toBeDefined();
  });

  it("has checks existence", async () => {
    const handle = await store.storeString("exists", "text/plain", "r");
    expect(await store.has(handle)).toBe(true);
    expect(
      await store.has("artifact://sha256/0000" as ArtifactHandle),
    ).toBe(false);
  });

  it("delete removes artifact", async () => {
    const handle = await store.storeString("delete me", "text/plain", "r");
    expect(await store.delete(handle)).toBe(true);
    expect(await store.has(handle)).toBe(false);
    expect(await store.retrieve(handle)).toBeNull();
    expect(store.getMetadata(handle)).toBeNull();
  });

  it("returns null for nonexistent retrieve", async () => {
    const handle = "artifact://sha256/nonexistent" as ArtifactHandle;
    expect(await store.retrieve(handle)).toBeNull();
    expect(await store.retrieveString(handle)).toBeNull();
  });

  it("lists all metadata", async () => {
    await store.storeString("a", "text/plain", "r1");
    await store.storeString("b", "text/plain", "r2");
    await store.storeString("c", "text/plain", "r1");

    const all = store.listMetadata();
    expect(all).toHaveLength(3);
  });

  it("lists by run", async () => {
    await store.storeString("a", "text/plain", "r1");
    await store.storeString("b", "text/plain", "r2");
    await store.storeString("c", "text/plain", "r1");

    const r1 = store.listByRun("r1");
    expect(r1).toHaveLength(2);
    expect(r1.every((m) => m.run_id === "r1")).toBe(true);
  });
});
