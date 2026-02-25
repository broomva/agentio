/**
 * @agentio/kernel-schema — Schema engine
 *
 * Parse, validate, resolve, and derive from AppSchema.
 * Pure logic — no I/O. Depends only on @agentio/protocol.
 */

import type {
  AppSchema,
  CapabilitySchema,
  EntitySchema,
  FieldSchema,
  ToolContract,
  ViewSchema,
} from "@agentio/protocol";
import { validateAppSchema } from "@agentio/protocol";

// ─── Parse & Validate ───────────────────────────────────────────────────────

/** Parse and validate raw JSON into a typed AppSchema. Throws on invalid input. */
export function parseSchema(json: unknown): AppSchema {
  const result = validateAppSchema(json);
  if (!result.valid) {
    throw new Error(`Invalid AppSchema: ${result.errors.join("; ")}`);
  }
  return json as AppSchema;
}

// ─── Resolve ────────────────────────────────────────────────────────────────

/** Look up an entity by name. */
export function resolveEntity(schema: AppSchema, name: string): EntitySchema | null {
  return schema.entities.find((e) => e.name === name) ?? null;
}

/** Look up a capability by name. */
export function resolveCapability(schema: AppSchema, name: string): CapabilitySchema | null {
  return schema.capabilities.find((c) => c.name === name) ?? null;
}

/** Look up a view by route. */
export function resolveView(schema: AppSchema, route: string): ViewSchema | null {
  return schema.views.find((v) => v.route === route) ?? null;
}

/** Look up a view by name. */
export function resolveViewByName(schema: AppSchema, name: string): ViewSchema | null {
  return schema.views.find((v) => v.name === name) ?? null;
}

// ─── Derive ─────────────────────────────────────────────────────────────────

/** Convert a FieldSchema type to a JSON Schema type string. */
function fieldTypeToJsonSchema(ft: FieldSchema["type"]): string {
  switch (ft) {
    case "string":
    case "date":
    case "reference":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "list":
      return "array";
  }
}

/** Convert a list of FieldSchema into a JSON Schema properties object. */
function fieldsToJsonSchema(fields: FieldSchema[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.name] = {
      type: fieldTypeToJsonSchema(field.type),
      ...(field.description ? { description: field.description } : {}),
    };
    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/** Derive ToolContract[] from an AppSchema's capabilities. */
export function deriveToolContracts(schema: AppSchema): ToolContract[] {
  return schema.capabilities.map((cap) => ({
    name: cap.name,
    description: cap.description,
    input_schema: fieldsToJsonSchema(cap.input),
    output_schema: fieldsToJsonSchema(cap.output),
    capabilities: cap.side_effects,
    idempotent: !cap.requires_approval && cap.side_effects.length === 0,
  }));
}

// ─── Describe ───────────────────────────────────────────────────────────────

/** Generate a human/AI-readable summary of an AppSchema. */
export function describeSchema(schema: AppSchema): string {
  const lines: string[] = [];
  lines.push(`# ${schema.name} v${schema.version}`);
  lines.push("");

  lines.push(`## Entities (${schema.entities.length})`);
  for (const entity of schema.entities) {
    const fieldNames = entity.fields.map((f) => f.name).join(", ");
    lines.push(`- **${entity.name}** (${entity.storage}): ${entity.description} [${fieldNames}]`);
  }
  lines.push("");

  lines.push(`## Capabilities (${schema.capabilities.length})`);
  for (const cap of schema.capabilities) {
    const approval = cap.requires_approval ? " [requires approval]" : "";
    lines.push(`- **${cap.name}**: ${cap.description}${approval}`);
  }
  lines.push("");

  lines.push(`## Views (${schema.views.length})`);
  for (const view of schema.views) {
    lines.push(`- **${view.name}** (${view.route}): ${view.description}`);
  }
  lines.push("");

  lines.push(`## Governance`);
  lines.push(`- Policy: ${schema.governance.policy_profile}`);
  lines.push(`- Mode: ${schema.governance.controller_mode}`);
  lines.push(`- Max concurrent runs: ${schema.governance.max_concurrent_runs}`);

  return lines.join("\n");
}
