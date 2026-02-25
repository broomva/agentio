/**
 * @agentio/kernel-artifact — Content-addressed artifact store
 *
 * SHA-256 hashing, artifact:// URI generation, metadata tracking.
 * Uses a pluggable backend interface for actual storage.
 *
 * Default backend: in-memory (for testing and embedded use).
 * Filesystem backend can be implemented in driver-exec.
 */

import type { ArtifactHandle, ArtifactMetadata } from "@agentio/protocol";
import { ARTIFACT_SCHEME, artifactHandle } from "@agentio/protocol";

// ─── Backend Interface ──────────────────────────────────────────────────────

export interface ArtifactBackend {
  /** Write raw bytes, keyed by hex hash. */
  put(hash: string, data: Uint8Array): Promise<void>;
  /** Read raw bytes by hex hash, or null if not found. */
  get(hash: string): Promise<Uint8Array | null>;
  /** Check if a hash exists in the store. */
  has(hash: string): Promise<boolean>;
  /** Delete by hex hash. Returns true if it existed. */
  delete(hash: string): Promise<boolean>;
}

// ─── In-Memory Backend ──────────────────────────────────────────────────────

export class MemoryBackend implements ArtifactBackend {
  private store = new Map<string, Uint8Array>();

  async put(hash: string, data: Uint8Array): Promise<void> {
    this.store.set(hash, data);
  }

  async get(hash: string): Promise<Uint8Array | null> {
    return this.store.get(hash) ?? null;
  }

  async has(hash: string): Promise<boolean> {
    return this.store.has(hash);
  }

  async delete(hash: string): Promise<boolean> {
    return this.store.delete(hash);
  }

  /** Number of stored artifacts (for testing). */
  get size(): number {
    return this.store.size;
  }

  /** Clear all stored artifacts (for testing). */
  clear(): void {
    this.store.clear();
  }
}

// ─── SHA-256 Hashing ────────────────────────────────────────────────────────

/** Compute SHA-256 hex hash of a Uint8Array using Web Crypto API. */
export async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as ArrayBufferView<ArrayBuffer>);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compute SHA-256 of a UTF-8 string. */
export async function sha256String(text: string): Promise<string> {
  return sha256(new TextEncoder().encode(text));
}

// ─── Artifact Store ─────────────────────────────────────────────────────────

export class ArtifactStore {
  private backend: ArtifactBackend;
  private metadata = new Map<string, ArtifactMetadata>();

  constructor(backend?: ArtifactBackend) {
    this.backend = backend ?? new MemoryBackend();
  }

  /** Store a blob and return its content-addressed handle. */
  async store(
    data: Uint8Array,
    mime: string,
    runId: string,
  ): Promise<ArtifactHandle> {
    const hash = await sha256(data);
    const handle = artifactHandle(hash);

    // Deduplication: only write if not already stored
    if (!(await this.backend.has(hash))) {
      await this.backend.put(hash, data);
    }

    // Always update metadata (last writer wins for run_id attribution)
    this.metadata.set(hash, {
      handle,
      size: data.byteLength,
      mime,
      created_at: new Date().toISOString(),
      run_id: runId,
    });

    return handle;
  }

  /** Store a UTF-8 string as an artifact. */
  async storeString(
    text: string,
    mime: string,
    runId: string,
  ): Promise<ArtifactHandle> {
    return this.store(new TextEncoder().encode(text), mime, runId);
  }

  /** Retrieve artifact data by handle. */
  async retrieve(handle: ArtifactHandle): Promise<Uint8Array | null> {
    const hash = extractHash(handle);
    if (!hash) return null;
    return this.backend.get(hash);
  }

  /** Retrieve artifact data as a UTF-8 string. */
  async retrieveString(handle: ArtifactHandle): Promise<string | null> {
    const data = await this.retrieve(handle);
    if (!data) return null;
    return new TextDecoder().decode(data);
  }

  /** Get metadata for an artifact. */
  getMetadata(handle: ArtifactHandle): ArtifactMetadata | null {
    const hash = extractHash(handle);
    if (!hash) return null;
    return this.metadata.get(hash) ?? null;
  }

  /** Check if an artifact exists in the store. */
  async has(handle: ArtifactHandle): Promise<boolean> {
    const hash = extractHash(handle);
    if (!hash) return false;
    return this.backend.has(hash);
  }

  /** Delete an artifact by handle. Returns true if it existed. */
  async delete(handle: ArtifactHandle): Promise<boolean> {
    const hash = extractHash(handle);
    if (!hash) return false;
    this.metadata.delete(hash);
    return this.backend.delete(hash);
  }

  /** List all artifact metadata. */
  listMetadata(): ArtifactMetadata[] {
    return Array.from(this.metadata.values());
  }

  /** List artifacts for a specific run. */
  listByRun(runId: string): ArtifactMetadata[] {
    return this.listMetadata().filter((m) => m.run_id === runId);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract the hex hash from an artifact handle URI. */
export function extractHash(handle: ArtifactHandle): string | null {
  if (!handle.startsWith(ARTIFACT_SCHEME)) return null;
  const path = handle.slice(ARTIFACT_SCHEME.length);
  // Expected format: sha256/<hex>
  const parts = path.split("/");
  if (parts.length === 2 && parts[0] === "sha256") return parts[1];
  // Fallback: treat entire path as hash
  return path;
}

// ─── Re-exports for backwards compat with stub API ──────────────────────────

export function store(data: Uint8Array, _mime: string): ArtifactHandle {
  // Synchronous stub — real usage should use ArtifactStore.store()
  // This generates a handle but doesn't actually store the data
  const hex = Array.from(data.slice(0, 32))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return artifactHandle(hex);
}

export function metadata(_handle: ArtifactHandle): ArtifactMetadata | null {
  return null;
}

export function retrieve(_handle: ArtifactHandle): Uint8Array | null {
  return null;
}
