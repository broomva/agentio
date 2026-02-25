import { describe, it, expect } from "bun:test";
import type { AppSchema } from "@agentio/protocol";
import {
  parseSchema,
  resolveEntity,
  resolveCapability,
  resolveView,
  resolveViewByName,
  deriveToolContracts,
  describeSchema,
} from "../src/index.js";

function sampleSchema(): AppSchema {
  return {
    name: "agent-os",
    version: "1.0.0",
    entities: [
      {
        name: "Run",
        description: "An agent run",
        fields: [
          { name: "run_id", type: "string", required: true },
          { name: "status", type: "string", required: true },
          { name: "objective", type: "string", required: true },
        ],
        storage: "state",
      },
      {
        name: "Artifact",
        description: "A content-addressed output",
        fields: [
          { name: "handle", type: "string", required: true },
          { name: "size", type: "number", required: true },
          { name: "mime", type: "string", required: true },
        ],
        storage: "artifact",
      },
    ],
    capabilities: [
      {
        name: "execute_run",
        description: "Create and execute an agent run",
        input: [
          { name: "objective", type: "string", required: true },
          { name: "agent_id", type: "string", required: true },
        ],
        output: [
          { name: "run_id", type: "string", required: true },
          { name: "status", type: "string", required: true },
        ],
        side_effects: ["writes:state/runs", "emits:run.started"],
        requires_approval: false,
      },
      {
        name: "store_artifact",
        description: "Store a content-addressed artifact",
        input: [
          { name: "data", type: "string", required: true },
          { name: "mime", type: "string", required: true },
        ],
        output: [
          { name: "handle", type: "string", required: true },
        ],
        side_effects: ["writes:artifacts"],
        requires_approval: true,
      },
    ],
    views: [
      {
        name: "dashboard",
        route: "/",
        description: "Agent dashboard",
        data_sources: ["Run"],
        actions: ["execute_run"],
        layout: [{ type: "text", props: { content: "Dashboard" } }],
      },
      {
        name: "run_history",
        route: "/runs",
        description: "Run history list",
        data_sources: ["Run"],
        actions: [],
        layout: [{ type: "list", props: { entity: "Run" } }],
      },
    ],
    memory: {
      core_fields: [
        { name: "key", type: "string", required: true },
        { name: "value", type: "string", required: true },
      ],
      working_ttl_ms: 3600000,
      max_core_entries: 1000,
    },
    governance: {
      policy_profile: "ci_safe",
      budgets: { max_time_ms: 3600000, max_tokens: 100000 },
      max_concurrent_runs: 5,
      controller_mode: "autonomous",
    },
  };
}

describe("kernel-schema: parseSchema", () => {
  it("parses a valid schema", () => {
    const schema = parseSchema(sampleSchema());
    expect(schema.name).toBe("agent-os");
    expect(schema.version).toBe("1.0.0");
    expect(schema.entities.length).toBe(2);
    expect(schema.capabilities.length).toBe(2);
  });

  it("throws on invalid schema", () => {
    expect(() => parseSchema({})).toThrow("Invalid AppSchema");
  });

  it("throws on null", () => {
    expect(() => parseSchema(null)).toThrow("Invalid AppSchema");
  });

  it("round-trips through JSON", () => {
    const original = sampleSchema();
    const json = JSON.parse(JSON.stringify(original));
    const parsed = parseSchema(json);
    expect(parsed.name).toBe(original.name);
    expect(parsed.entities.length).toBe(original.entities.length);
    expect(parsed.capabilities.length).toBe(original.capabilities.length);
  });
});

describe("kernel-schema: resolveEntity", () => {
  const schema = sampleSchema();

  it("finds an entity by name", () => {
    const entity = resolveEntity(schema, "Run");
    expect(entity).not.toBeNull();
    expect(entity!.name).toBe("Run");
    expect(entity!.description).toBe("An agent run");
  });

  it("returns null for unknown entity", () => {
    expect(resolveEntity(schema, "Unknown")).toBeNull();
  });
});

describe("kernel-schema: resolveCapability", () => {
  const schema = sampleSchema();

  it("finds a capability by name", () => {
    const cap = resolveCapability(schema, "execute_run");
    expect(cap).not.toBeNull();
    expect(cap!.name).toBe("execute_run");
    expect(cap!.requires_approval).toBe(false);
  });

  it("returns null for unknown capability", () => {
    expect(resolveCapability(schema, "unknown_action")).toBeNull();
  });
});

describe("kernel-schema: resolveView", () => {
  const schema = sampleSchema();

  it("finds a view by route", () => {
    const view = resolveView(schema, "/");
    expect(view).not.toBeNull();
    expect(view!.name).toBe("dashboard");
  });

  it("finds a view by route /runs", () => {
    const view = resolveView(schema, "/runs");
    expect(view).not.toBeNull();
    expect(view!.name).toBe("run_history");
  });

  it("returns null for unknown route", () => {
    expect(resolveView(schema, "/unknown")).toBeNull();
  });
});

describe("kernel-schema: resolveViewByName", () => {
  const schema = sampleSchema();

  it("finds a view by name", () => {
    const view = resolveViewByName(schema, "dashboard");
    expect(view).not.toBeNull();
    expect(view!.route).toBe("/");
  });

  it("returns null for unknown name", () => {
    expect(resolveViewByName(schema, "unknown")).toBeNull();
  });
});

describe("kernel-schema: deriveToolContracts", () => {
  const schema = sampleSchema();
  const contracts = deriveToolContracts(schema);

  it("derives one contract per capability", () => {
    expect(contracts.length).toBe(2);
  });

  it("maps name and description", () => {
    expect(contracts[0].name).toBe("execute_run");
    expect(contracts[0].description).toBe("Create and execute an agent run");
  });

  it("generates input_schema with properties", () => {
    const input = contracts[0].input_schema as {
      type: string;
      properties: Record<string, { type: string }>;
      required: string[];
    };
    expect(input.type).toBe("object");
    expect(input.properties.objective.type).toBe("string");
    expect(input.required).toContain("objective");
  });

  it("generates output_schema with properties", () => {
    const output = contracts[0].output_schema as {
      type: string;
      properties: Record<string, { type: string }>;
    };
    expect(output.type).toBe("object");
    expect(output.properties.run_id.type).toBe("string");
  });

  it("maps side_effects to capabilities", () => {
    expect(contracts[0].capabilities).toContain("writes:state/runs");
    expect(contracts[0].capabilities).toContain("emits:run.started");
  });

  it("sets idempotent based on side_effects and approval", () => {
    // execute_run has side effects → not idempotent
    expect(contracts[0].idempotent).toBe(false);
    // store_artifact requires approval → not idempotent
    expect(contracts[1].idempotent).toBe(false);
  });
});

describe("kernel-schema: describeSchema", () => {
  it("generates a readable summary", () => {
    const description = describeSchema(sampleSchema());
    expect(description).toContain("agent-os v1.0.0");
    expect(description).toContain("Run");
    expect(description).toContain("Artifact");
    expect(description).toContain("execute_run");
    expect(description).toContain("dashboard");
    expect(description).toContain("ci_safe");
  });

  it("marks capabilities requiring approval", () => {
    const description = describeSchema(sampleSchema());
    expect(description).toContain("[requires approval]");
  });
});
