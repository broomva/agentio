/**
 * @agentio/kernel-artifact — Artifact store
 *
 * Content-addressed blob storage and retrieval.
 * Handles artifact creation, deduplication, and metadata tracking.
 */

import type { ArtifactHandle, ArtifactMetadata } from "@agentio/protocol";
import { ARTIFACT_SCHEME } from "@agentio/protocol";

/** Placeholder: store a blob and return its content-addressed handle */
export function store(_data: Uint8Array, _mime: string): ArtifactHandle {
  return `${ARTIFACT_SCHEME}sha256/placeholder` as ArtifactHandle;
}

/** Placeholder: retrieve artifact metadata by handle */
export function metadata(_handle: ArtifactHandle): ArtifactMetadata | null {
  return null;
}

/** Placeholder: retrieve artifact data by handle */
export function retrieve(_handle: ArtifactHandle): Uint8Array | null {
  return null;
}
