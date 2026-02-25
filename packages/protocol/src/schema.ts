/**
 * @agentio/protocol — App Schema types
 *
 * The DNA of an agent-app. Drives UI, behavior, and state shape.
 * Zero external dependencies.
 */

import type { RunBudgets, ValidationResult } from "./index.js";

// ─── Domain Model ───────────────────────────────────────────────────────────

/** A field in an entity, capability input/output, or memory schema. */
export interface FieldSchema {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "reference" | "list";
  required: boolean;
  reference?: string;
  description?: string;
}

/** A domain entity — a thing the app knows about. */
export interface EntitySchema {
  name: string;
  description: string;
  fields: FieldSchema[];
  storage: "state" | "artifact";
}

// ─── Capabilities ───────────────────────────────────────────────────────────

/** Something the agent can do. */
export interface CapabilitySchema {
  name: string;
  description: string;
  input: FieldSchema[];
  output: FieldSchema[];
  side_effects: string[];
  requires_approval: boolean;
}

// ─── Views ──────────────────────────────────────────────────────────────────

/** A UI component definition. */
export interface ComponentSchema {
  type: string;
  props: Record<string, unknown>;
  children?: ComponentSchema[];
  bind?: string;
}

/** A view — how state projects through an interface. */
export interface ViewSchema {
  name: string;
  route: string;
  description: string;
  data_sources: string[];
  actions: string[];
  layout: ComponentSchema[];
}

// ─── Memory ─────────────────────────────────────────────────────────────────

/** Memory structure definition. */
export interface MemorySchema {
  core_fields: FieldSchema[];
  working_ttl_ms: number;
  max_core_entries: number;
}

// ─── Governance ─────────────────────────────────────────────────────────────

/** Default governance settings for the agent-app. */
export interface GovernanceDefaults {
  policy_profile: string;
  budgets: RunBudgets;
  max_concurrent_runs: number;
  controller_mode: "autonomous" | "supervised" | "manual";
}

// ─── AppSchema ──────────────────────────────────────────────────────────────

/** The DNA of an agent-app. Drives UI, behavior, and state shape. */
export interface AppSchema {
  name: string;
  version: string;
  entities: EntitySchema[];
  capabilities: CapabilitySchema[];
  views: ViewSchema[];
  memory: MemorySchema;
  governance: GovernanceDefaults;
}

// ─── Field Type Constants ───────────────────────────────────────────────────

export const FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "reference",
  "list",
] as const;

export const STORAGE_TYPES = ["state", "artifact"] as const;

export const CONTROLLER_MODES = ["autonomous", "supervised", "manual"] as const;

// ─── Validation ─────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateFieldSchema(obj: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(obj)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (typeof obj.name !== "string" || obj.name.length === 0)
    errors.push(`${path}.name must be a non-empty string`);
  if (typeof obj.type !== "string" || !(FIELD_TYPES as readonly string[]).includes(obj.type))
    errors.push(`${path}.type must be one of: ${FIELD_TYPES.join(", ")}`);
  if (typeof obj.required !== "boolean")
    errors.push(`${path}.required must be a boolean`);
  return errors;
}

function validateEntitySchema(obj: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(obj)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (typeof obj.name !== "string" || obj.name.length === 0)
    errors.push(`${path}.name must be a non-empty string`);
  if (typeof obj.description !== "string")
    errors.push(`${path}.description must be a string`);
  if (typeof obj.storage !== "string" || !(STORAGE_TYPES as readonly string[]).includes(obj.storage))
    errors.push(`${path}.storage must be one of: ${STORAGE_TYPES.join(", ")}`);
  if (!Array.isArray(obj.fields))
    errors.push(`${path}.fields must be an array`);
  else
    obj.fields.forEach((f: unknown, i: number) =>
      errors.push(...validateFieldSchema(f, `${path}.fields[${i}]`))
    );
  return errors;
}

function validateCapabilitySchema(obj: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(obj)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (typeof obj.name !== "string" || obj.name.length === 0)
    errors.push(`${path}.name must be a non-empty string`);
  if (typeof obj.description !== "string")
    errors.push(`${path}.description must be a string`);
  if (!Array.isArray(obj.input))
    errors.push(`${path}.input must be an array`);
  else
    obj.input.forEach((f: unknown, i: number) =>
      errors.push(...validateFieldSchema(f, `${path}.input[${i}]`))
    );
  if (!Array.isArray(obj.output))
    errors.push(`${path}.output must be an array`);
  else
    obj.output.forEach((f: unknown, i: number) =>
      errors.push(...validateFieldSchema(f, `${path}.output[${i}]`))
    );
  if (!Array.isArray(obj.side_effects))
    errors.push(`${path}.side_effects must be an array`);
  if (typeof obj.requires_approval !== "boolean")
    errors.push(`${path}.requires_approval must be a boolean`);
  return errors;
}

function validateViewSchema(obj: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(obj)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (typeof obj.name !== "string" || obj.name.length === 0)
    errors.push(`${path}.name must be a non-empty string`);
  if (typeof obj.route !== "string")
    errors.push(`${path}.route must be a string`);
  if (typeof obj.description !== "string")
    errors.push(`${path}.description must be a string`);
  if (!Array.isArray(obj.data_sources))
    errors.push(`${path}.data_sources must be an array`);
  if (!Array.isArray(obj.actions))
    errors.push(`${path}.actions must be an array`);
  if (!Array.isArray(obj.layout))
    errors.push(`${path}.layout must be an array`);
  return errors;
}

function validateMemorySchema(obj: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(obj)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (!Array.isArray(obj.core_fields))
    errors.push(`${path}.core_fields must be an array`);
  else
    obj.core_fields.forEach((f: unknown, i: number) =>
      errors.push(...validateFieldSchema(f, `${path}.core_fields[${i}]`))
    );
  if (typeof obj.working_ttl_ms !== "number" || obj.working_ttl_ms < 0)
    errors.push(`${path}.working_ttl_ms must be a non-negative number`);
  if (typeof obj.max_core_entries !== "number" || obj.max_core_entries < 0)
    errors.push(`${path}.max_core_entries must be a non-negative number`);
  return errors;
}

function validateGovernanceDefaults(obj: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isObject(obj)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (typeof obj.policy_profile !== "string")
    errors.push(`${path}.policy_profile must be a string`);
  if (!isObject(obj.budgets))
    errors.push(`${path}.budgets must be an object`);
  else {
    const b = obj.budgets;
    if (typeof b.max_time_ms !== "number")
      errors.push(`${path}.budgets.max_time_ms must be a number`);
    if (typeof b.max_tokens !== "number")
      errors.push(`${path}.budgets.max_tokens must be a number`);
  }
  if (typeof obj.max_concurrent_runs !== "number" || obj.max_concurrent_runs < 0)
    errors.push(`${path}.max_concurrent_runs must be a non-negative number`);
  if (typeof obj.controller_mode !== "string" || !(CONTROLLER_MODES as readonly string[]).includes(obj.controller_mode))
    errors.push(`${path}.controller_mode must be one of: ${CONTROLLER_MODES.join(", ")}`);
  return errors;
}

/** Validate an AppSchema at runtime. */
export function validateAppSchema(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(obj)) {
    return { valid: false, errors: ["must be an object"] };
  }
  if (typeof obj.name !== "string" || obj.name.length === 0)
    errors.push("name must be a non-empty string");
  if (typeof obj.version !== "string" || obj.version.length === 0)
    errors.push("version must be a non-empty string");
  if (!Array.isArray(obj.entities))
    errors.push("entities must be an array");
  else
    obj.entities.forEach((e: unknown, i: number) =>
      errors.push(...validateEntitySchema(e, `entities[${i}]`))
    );
  if (!Array.isArray(obj.capabilities))
    errors.push("capabilities must be an array");
  else
    obj.capabilities.forEach((c: unknown, i: number) =>
      errors.push(...validateCapabilitySchema(c, `capabilities[${i}]`))
    );
  if (!Array.isArray(obj.views))
    errors.push("views must be an array");
  else
    obj.views.forEach((v: unknown, i: number) =>
      errors.push(...validateViewSchema(v, `views[${i}]`))
    );
  errors.push(...validateMemorySchema(obj.memory, "memory"));
  errors.push(...validateGovernanceDefaults(obj.governance, "governance"));
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
