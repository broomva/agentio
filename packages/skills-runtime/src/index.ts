/**
 * @agentio/skills-runtime — Skills runtime
 *
 * Load, validate, and invoke composable agent skills.
 * Skills are higher-level capabilities built on top of tool drivers.
 */

import type { ToolContract } from "@agentio/protocol";
import type { ExecResult } from "@agentio/driver-exec";

export interface Skill {
  name: string;
  description: string;
  tools: ToolContract[];
  version: string;
}

/** Placeholder: load a skill by name */
export function loadSkill(_name: string): Skill | null {
  return null;
}

/** Placeholder: invoke a skill with given input */
export async function invokeSkill(
  _skill: Skill,
  _input: Record<string, unknown>
): Promise<ExecResult> {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    artifacts: [],
    durationMs: 0,
  };
}

/** Placeholder: list all registered skills */
export function listSkills(): Skill[] {
  return [];
}
