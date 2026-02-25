import { describe, it, expect } from "bun:test";
import {
  validateAppSchema,
  FIELD_TYPES,
  STORAGE_TYPES,
  CONTROLLER_MODES,
} from "../src/index.js";
import type { AppSchema } from "../src/index.js";

function minimalSchema(): AppSchema {
  return {
    name: "test-app",
    version: "1.0.0",
    entities: [
      {
        name: "Task",
        description: "A task entity",
        fields: [
          { name: "title", type: "string", required: true },
        ],
        storage: "state",
      },
    ],
    capabilities: [
      {
        name: "create_task",
        description: "Create a task",
        input: [{ name: "title", type: "string", required: true }],
        output: [{ name: "task_id", type: "string", required: true }],
        side_effects: ["writes:state/tasks"],
        requires_approval: false,
      },
    ],
    views: [
      {
        name: "task_list",
        route: "/tasks",
        description: "List of tasks",
        data_sources: ["Task"],
        actions: ["create_task"],
        layout: [{ type: "list", props: {} }],
      },
    ],
    memory: {
      core_fields: [
        { name: "key", type: "string", required: true },
      ],
      working_ttl_ms: 3600000,
      max_core_entries: 100,
    },
    governance: {
      policy_profile: "ci_safe",
      budgets: { max_time_ms: 3600000, max_tokens: 100000 },
      max_concurrent_runs: 3,
      controller_mode: "autonomous",
    },
  };
}

describe("schema constants", () => {
  it("FIELD_TYPES has all field types", () => {
    expect(FIELD_TYPES).toContain("string");
    expect(FIELD_TYPES).toContain("number");
    expect(FIELD_TYPES).toContain("reference");
    expect(FIELD_TYPES.length).toBe(6);
  });

  it("STORAGE_TYPES has state and artifact", () => {
    expect(STORAGE_TYPES).toContain("state");
    expect(STORAGE_TYPES).toContain("artifact");
  });

  it("CONTROLLER_MODES matches expected values", () => {
    expect(CONTROLLER_MODES).toContain("autonomous");
    expect(CONTROLLER_MODES).toContain("supervised");
    expect(CONTROLLER_MODES).toContain("manual");
  });
});

describe("validateAppSchema", () => {
  it("passes for a valid minimal schema", () => {
    const result = validateAppSchema(minimalSchema());
    expect(result.valid).toBe(true);
  });

  it("fails for null", () => {
    const result = validateAppSchema(null);
    expect(result.valid).toBe(false);
  });

  it("fails for missing name", () => {
    const schema = minimalSchema();
    (schema as Record<string, unknown>).name = "";
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    }
  });

  it("fails for missing version", () => {
    const schema = minimalSchema();
    (schema as Record<string, unknown>).version = "";
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
  });

  it("fails for invalid entity storage type", () => {
    const schema = minimalSchema();
    (schema.entities[0] as Record<string, unknown>).storage = "database";
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("storage"))).toBe(true);
    }
  });

  it("fails for invalid field type", () => {
    const schema = minimalSchema();
    (schema.entities[0].fields[0] as Record<string, unknown>).type = "invalid";
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("type"))).toBe(true);
    }
  });

  it("fails for missing capability fields", () => {
    const schema = minimalSchema();
    (schema.capabilities[0] as Record<string, unknown>).input = "not-array";
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
  });

  it("fails for invalid governance controller_mode", () => {
    const schema = minimalSchema();
    (schema.governance as Record<string, unknown>).controller_mode = "rogue";
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
  });

  it("fails for negative memory limits", () => {
    const schema = minimalSchema();
    schema.memory.working_ttl_ms = -1;
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
  });

  it("validates nested field schemas in capabilities", () => {
    const schema = minimalSchema();
    schema.capabilities[0].input = [
      { name: "", type: "string", required: true },
    ];
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("input[0].name"))).toBe(true);
    }
  });

  it("validates view schema structure", () => {
    const schema = minimalSchema();
    (schema.views[0] as Record<string, unknown>).route = 42;
    const result = validateAppSchema(schema);
    expect(result.valid).toBe(false);
  });
});
