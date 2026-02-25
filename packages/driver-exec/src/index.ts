/**
 * @agentio/driver-exec — Execution driver + Agent filesystem
 *
 * Provides:
 * - AgentFs: structured filesystem operations scoped to .agent/
 * - FilesystemBackend: ArtifactBackend backed by .agent/artifacts/
 * - execute/listTools: tool execution stubs (real impl in Phase C)
 */

import { readdir, readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ToolContract, ArtifactHandle, AgentEvent } from "@agentio/protocol";
import type { ArtifactBackend } from "@agentio/kernel-artifact";

// ─── ExecResult (existing API) ──────────────────────────────────────────────

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  artifacts: ArtifactHandle[];
  durationMs: number;
}

/** Placeholder: execute a tool call in a sandboxed environment */
export async function execute(
  _tool: ToolContract,
  _args: Record<string, unknown>
): Promise<ExecResult> {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    artifacts: [],
    durationMs: 0,
  };
}

/** Placeholder: list available tool contracts */
export function listTools(): ToolContract[] {
  return [];
}

// ─── AgentFs ────────────────────────────────────────────────────────────────

/** Structured filesystem operations scoped to .agent/ */
export class AgentFs {
  private readonly agentDir: string;

  constructor(rootDir: string) {
    this.agentDir = join(rootDir, ".agent");
  }

  /** Get the .agent/ directory path. */
  get basePath(): string {
    return this.agentDir;
  }

  /** Create .agent/ directory structure if missing. */
  async ensureStructure(): Promise<void> {
    const dirs = [
      this.agentDir,
      join(this.agentDir, "state"),
      join(this.agentDir, "runs"),
      join(this.agentDir, "memory"),
      join(this.agentDir, "memory", "working"),
      join(this.agentDir, "artifacts"),
      join(this.agentDir, "artifacts", "sha256"),
    ];
    for (const dir of dirs) {
      await mkdir(dir, { recursive: true });
    }
  }

  // ─── Schema ─────────────────────────────────────────────────────────────

  /** Read .agent/schema.json as raw JSON. */
  async readSchema(): Promise<unknown> {
    const content = await readFile(join(this.agentDir, "schema.json"), "utf-8");
    return JSON.parse(content);
  }

  // ─── State ──────────────────────────────────────────────────────────────

  /** Read .agent/state/<key>.json as raw JSON. */
  async readState(key: string): Promise<unknown> {
    const content = await readFile(
      join(this.agentDir, "state", `${key}.json`),
      "utf-8",
    );
    return JSON.parse(content);
  }

  /** Atomic write to .agent/state/<key>.json. */
  async writeState(key: string, data: unknown): Promise<void> {
    const target = join(this.agentDir, "state", `${key}.json`);
    await atomicWriteJson(target, data);
  }

  // ─── Runs ───────────────────────────────────────────────────────────────

  /** Append a JSON event line to .agent/runs/<runId>.jsonl */
  async appendRun(runId: string, event: AgentEvent): Promise<void> {
    const logPath = join(this.agentDir, "runs", `${runId}.jsonl`);
    await ensureDir(dirname(logPath));
    const line = JSON.stringify(event) + "\n";
    await writeFile(logPath, line, { flag: "a" });
  }

  /** Read all events from .agent/runs/<runId>.jsonl */
  async readRunLog(runId: string): Promise<AgentEvent[]> {
    const logPath = join(this.agentDir, "runs", `${runId}.jsonl`);
    let content: string;
    try {
      content = await readFile(logPath, "utf-8");
    } catch {
      return [];
    }
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as AgentEvent);
  }

  /** Read .agent/runs/index.json */
  async readRunIndex(): Promise<unknown> {
    const content = await readFile(
      join(this.agentDir, "runs", "index.json"),
      "utf-8",
    );
    return JSON.parse(content);
  }

  /** Atomic write to .agent/runs/index.json */
  async writeRunIndex(index: unknown): Promise<void> {
    const target = join(this.agentDir, "runs", "index.json");
    await atomicWriteJson(target, index);
  }

  // ─── Memory ─────────────────────────────────────────────────────────────

  /** Read .agent/memory/<key>.json */
  async readMemory(key: string): Promise<unknown> {
    const content = await readFile(
      join(this.agentDir, "memory", `${key}.json`),
      "utf-8",
    );
    return JSON.parse(content);
  }

  /** Atomic write to .agent/memory/<key>.json */
  async writeMemory(key: string, data: unknown): Promise<void> {
    const target = join(this.agentDir, "memory", `${key}.json`);
    await atomicWriteJson(target, data);
  }

  /** List memory keys (filenames without .json extension). */
  async listMemoryKeys(): Promise<string[]> {
    const memoryDir = join(this.agentDir, "memory");
    let entries: string[];
    try {
      entries = await readdir(memoryDir);
    } catch {
      return [];
    }
    return entries
      .filter((e) => e.endsWith(".json"))
      .map((e) => e.slice(0, -5));
  }
}

// ─── FilesystemBackend ──────────────────────────────────────────────────────

/** ArtifactBackend implementation backed by .agent/artifacts/sha256/ */
export class FilesystemBackend implements ArtifactBackend {
  private readonly artifactsDir: string;

  constructor(rootDir: string) {
    this.artifactsDir = join(rootDir, ".agent", "artifacts", "sha256");
  }

  async put(hash: string, data: Uint8Array): Promise<void> {
    await mkdir(this.artifactsDir, { recursive: true });
    const target = join(this.artifactsDir, hash);
    const tmp = target + ".tmp";
    await writeFile(tmp, data);
    await rename(tmp, target);
  }

  async get(hash: string): Promise<Uint8Array | null> {
    try {
      const buf = await readFile(join(this.artifactsDir, hash));
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  }

  async has(hash: string): Promise<boolean> {
    try {
      await stat(join(this.artifactsDir, hash));
      return true;
    } catch {
      return false;
    }
  }

  async delete(hash: string): Promise<boolean> {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(join(this.artifactsDir, hash));
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Ensure a directory exists. */
async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Atomic write: write to temp file then rename. */
async function atomicWriteJson(target: string, data: unknown): Promise<void> {
  await ensureDir(dirname(target));
  const tmp = target + ".tmp";
  await writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  await rename(tmp, target);
}
