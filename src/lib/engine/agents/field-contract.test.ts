/**
 * Holds every agent's output schema to its field contract (contract.ts):
 * each field has a row, CHOSEN fields are enums on the wire, JUDGED rules
 * are stated in the prompt, and COMPUTED fields never reach the model.
 *
 *   npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { FieldContract } from "./contract";
import { readSchema, READ_FIELDS } from "./read/schema";
import { resolveSchema, RESOLVE_FIELDS } from "./resolve/schema";
import { tagSchema, TAG_FIELDS } from "./tag/schema";
import { summarizeSchema, SUMMARIZE_FIELDS } from "./summarize/schema";

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
};

type Leaf = { path: string; schema: JsonSchema };

/** Every leaf field of a JSON schema, as `a.b`, `a[].b`, `a[]` paths. */
function leaves(schema: JsonSchema, path = ""): Leaf[] {
  if (schema.anyOf) {
    const nonNull = schema.anyOf.filter((s) => s.type !== "null");
    return nonNull.length === 1 ? leaves(nonNull[0], path) : [{ path, schema }];
  }
  if (schema.type === "object" && schema.properties) {
    return Object.entries(schema.properties).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  if (schema.type === "array" && schema.items) return leaves(schema.items, `${path}[]`);
  return [{ path, schema }];
}

const isChoice = (s: JsonSchema) => Array.isArray(s.enum) || s.type === "boolean";

const AGENTS: { key: string; schema: z.ZodType; contract: FieldContract }[] = [
  { key: "read", schema: readSchema, contract: READ_FIELDS },
  { key: "resolve", schema: resolveSchema(["c1", "c2"]), contract: RESOLVE_FIELDS },
  { key: "tag", schema: tagSchema(["burger", "pizza"], ["food", "vibe"]), contract: TAG_FIELDS },
  { key: "summarize", schema: summarizeSchema, contract: SUMMARIZE_FIELDS },
];

for (const agent of AGENTS) {
  const prompt = readFileSync(join(__dirname, agent.key, "prompt.v1.md"), "utf8");
  const fields = leaves(z.toJSONSchema(agent.schema) as JsonSchema);
  const onWire = new Set(fields.map((f) => f.path));

  test(`${agent.key}: every output field has a contract row`, () => {
    for (const f of fields) {
      const row = agent.contract[f.path];
      assert.ok(row, `${agent.key}.${f.path} has no row in the field contract`);
      assert.notEqual(row.kind, "COMPUTED", `${agent.key}.${f.path} is COMPUTED but the model outputs it`);
    }
  });

  test(`${agent.key}: every contract row is a field the model outputs (or COMPUTED)`, () => {
    for (const [path, row] of Object.entries(agent.contract)) {
      if (row.kind === "COMPUTED") continue;
      assert.ok(onWire.has(path), `${agent.key}.${path} is in the contract but not in the schema`);
    }
  });

  test(`${agent.key}: CHOSEN fields are enums on the wire`, () => {
    for (const f of fields) {
      if (agent.contract[f.path]?.kind !== "CHOSEN") continue;
      assert.ok(isChoice(f.schema), `${agent.key}.${f.path} is CHOSEN but not an enum`);
    }
  });

  test(`${agent.key}: JUDGED rules are stated in the prompt`, () => {
    for (const [path, row] of Object.entries(agent.contract)) {
      if (row.kind !== "JUDGED") continue;
      assert.ok(row.marker, `${agent.key}.${path} is JUDGED but has no marker`);
      assert.ok(prompt.includes(row.marker!), `${agent.key}.${path}: the prompt doesn't say "${row.marker}"`);
    }
  });
}
