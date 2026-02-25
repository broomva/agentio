import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execute, listTools, AgentFs, FilesystemBackend } from "../src/index.js";
import type { ToolContract, AgentEvent } from "@agentio/protocol";

// ─── Test helpers ───────────────────────────────────────────────────────────

let testDir: string;

function freshDir(): string {
  return join(tmpdir(), `agentio-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// ─── Existing API tests ─────────────────────────────────────────────────────

describe("driver-exec: execute", () => {
  it("returns a zero exit code by default", async () => {
    const tool: ToolContract = {
      name: "test-tool",
      description: "a test tool",
      input_schema: {},
      output_schema: {},
      capabilities: [],
      idempotent: true,
    };
    const result = await execute(tool, {});
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBe(0);
  });

  it("listTools returns an empty array", () => {
    expect(listTools()).toEqual([]);
  });
});

// ─── AgentFs tests ──────────────────────────────────────────────────────────

describe("driver-exec: AgentFs", () => {
  beforeEach(() => {
    testDir = freshDir();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("ensureStructure creates .agent/ directories", async () => {
    const fs = new AgentFs(testDir);
    await fs.ensureStructure();

    const agentDir = join(testDir, ".agent");
    const dirs = await readdir(agentDir);
    expect(dirs).toContain("state");
    expect(dirs).toContain("runs");
    expect(dirs).toContain("memory");
    expect(dirs).toContain("artifacts");
  });

  it("basePath returns correct path", () => {
    const fs = new AgentFs(testDir);
    expect(fs.basePath).toBe(join(testDir, ".agent"));
  });

  describe("state operations", () => {
    it("writeState + readState round-trips JSON", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      const data = { mode: "idle", count: 42 };
      await fs.writeState("agent", data);

      const read = await fs.readState("agent");
      expect(read).toEqual(data);
    });

    it("writeState overwrites existing data", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      await fs.writeState("session", { version: 1 });
      await fs.writeState("session", { version: 2 });

      const read = await fs.readState("session") as { version: number };
      expect(read.version).toBe(2);
    });

    it("readState throws for missing file", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      expect(fs.readState("nonexistent")).rejects.toThrow();
    });
  });

  describe("schema operations", () => {
    it("readSchema reads schema.json", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      // Manually write a schema.json
      const { writeFile } = await import("node:fs/promises");
      const schemaPath = join(testDir, ".agent", "schema.json");
      await writeFile(schemaPath, JSON.stringify({ name: "test", version: "1.0" }));

      const schema = await fs.readSchema() as { name: string };
      expect(schema.name).toBe("test");
    });
  });

  describe("run operations", () => {
    it("appendRun creates JSONL file and appends events", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      const event1: AgentEvent = {
        run_id: "run-1",
        agent_id: "agent-1",
        step_id: 0,
        event: "run.started",
        timestamp: new Date().toISOString(),
        envelope: {
          run_id: "run-1",
          parent_run_id: null,
          agent_id: "agent-1",
          base_ref: "main",
          repo_path: "repo://test",
          objective: "test",
          policy_profile: "ci_safe",
          budgets: { max_time_ms: 60000, max_tokens: 10000 },
          timestamp: new Date().toISOString(),
        },
      };

      const event2: AgentEvent = {
        run_id: "run-1",
        agent_id: "agent-1",
        step_id: 1,
        event: "tool.called",
        timestamp: new Date().toISOString(),
        tool: "test-tool",
        args: { cmd: "echo hello" },
      };

      await fs.appendRun("run-1", event1);
      await fs.appendRun("run-1", event2);

      const events = await fs.readRunLog("run-1");
      expect(events.length).toBe(2);
      expect(events[0].event).toBe("run.started");
      expect(events[1].event).toBe("tool.called");
    });

    it("readRunLog returns empty array for missing run", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      const events = await fs.readRunLog("nonexistent");
      expect(events).toEqual([]);
    });

    it("run index round-trips", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      const index = { version: 1, entries: [{ run_id: "run-1", status: "completed" }] };
      await fs.writeRunIndex(index);

      const read = await fs.readRunIndex();
      expect(read).toEqual(index);
    });
  });

  describe("memory operations", () => {
    it("writeMemory + readMemory round-trips", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      const data = { facts: ["TypeScript is typed", "Bun is fast"] };
      await fs.writeMemory("core", data);

      const read = await fs.readMemory("core");
      expect(read).toEqual(data);
    });

    it("listMemoryKeys returns .json files without extension", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      await fs.writeMemory("core", { key: "value" });
      await fs.writeMemory("project", { name: "agentio" });

      const keys = await fs.listMemoryKeys();
      expect(keys).toContain("core");
      expect(keys).toContain("project");
    });

    it("listMemoryKeys returns empty for fresh dir", async () => {
      const fs = new AgentFs(testDir);
      await fs.ensureStructure();

      const keys = await fs.listMemoryKeys();
      expect(keys).toEqual([]);
    });
  });
});

// ─── FilesystemBackend tests ────────────────────────────────────────────────

describe("driver-exec: FilesystemBackend", () => {
  beforeEach(() => {
    testDir = freshDir();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("put + get round-trips binary data", async () => {
    const backend = new FilesystemBackend(testDir);
    const agentFs = new AgentFs(testDir);
    await agentFs.ensureStructure();

    const data = new TextEncoder().encode("hello world");
    await backend.put("abc123", data);

    const result = await backend.get("abc123");
    expect(result).not.toBeNull();
    expect(new TextDecoder().decode(result!)).toBe("hello world");
  });

  it("has returns true for stored artifact", async () => {
    const backend = new FilesystemBackend(testDir);
    const agentFs = new AgentFs(testDir);
    await agentFs.ensureStructure();

    const data = new TextEncoder().encode("test");
    await backend.put("def456", data);

    expect(await backend.has("def456")).toBe(true);
  });

  it("has returns false for missing artifact", async () => {
    const backend = new FilesystemBackend(testDir);
    expect(await backend.has("nonexistent")).toBe(false);
  });

  it("get returns null for missing artifact", async () => {
    const backend = new FilesystemBackend(testDir);
    expect(await backend.get("nonexistent")).toBeNull();
  });

  it("delete removes stored artifact", async () => {
    const backend = new FilesystemBackend(testDir);
    const agentFs = new AgentFs(testDir);
    await agentFs.ensureStructure();

    const data = new TextEncoder().encode("to-delete");
    await backend.put("todel", data);
    expect(await backend.has("todel")).toBe(true);

    const deleted = await backend.delete("todel");
    expect(deleted).toBe(true);
    expect(await backend.has("todel")).toBe(false);
  });

  it("delete returns false for missing artifact", async () => {
    const backend = new FilesystemBackend(testDir);
    expect(await backend.delete("nonexistent")).toBe(false);
  });
});
