/**
 * @agentio/kernel-state — State manager
 *
 * Aggregate run, artifact, and event state into a coherent view.
 * Provides a unified query surface over the kernel subsystems.
 */

import type { RunEnvelope, RunSummary, ArtifactMetadata } from "@agentio/protocol";
import { createRun, finaliseRun } from "@agentio/kernel-run";
import { metadata } from "@agentio/kernel-artifact";

export interface KernelState {
  activeRuns: Map<string, RunEnvelope>;
  completedRuns: Map<string, RunSummary>;
  artifacts: Map<string, ArtifactMetadata>;
}

/** Placeholder: initialise an empty kernel state */
export function initState(): KernelState {
  return {
    activeRuns: new Map(),
    completedRuns: new Map(),
    artifacts: new Map(),
  };
}

/** Placeholder: get the current state snapshot */
export function snapshot(_state: KernelState): {
  activeRunCount: number;
  completedRunCount: number;
  artifactCount: number;
} {
  return {
    activeRunCount: _state.activeRuns.size,
    completedRunCount: _state.completedRuns.size,
    artifactCount: _state.artifacts.size,
  };
}
