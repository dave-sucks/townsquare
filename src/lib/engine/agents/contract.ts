/**
 * The field contract (Hindsight's rule, spelled out in docs/ENGINE_SPEC.md):
 * every field an agent outputs has a kind, and field-contract.test.ts holds
 * the schemas and prompts to it.
 *
 *   COMPUTED  code decides; the field is not in the schema
 *   CHOSEN    the model picks from an enum (or a yes/no)
 *   JUDGED    the model decides under a rule a gate checks; the rule's
 *             marker text must appear in the prompt
 *   IDENTITY  must reference something that exists (a gate checks it)
 *   TEXT      the model's own words
 */

export type FieldKind = "COMPUTED" | "CHOSEN" | "JUDGED" | "IDENTITY" | "TEXT";

export type FieldRule = {
  kind: FieldKind;
  /** What the field means, and for JUDGED / IDENTITY what the gate checks. */
  rule: string;
  /** JUDGED only: text that states the rule in the prompt. */
  marker?: string;
};

/** Keyed by path: `places[].excerpt`, `tags[].slug`. */
export type FieldContract = Record<string, FieldRule>;

/** Models report confidence as a bucket; code maps it to a number. */
export const CONFIDENCE_BUCKETS = ["high", "medium", "low"] as const;
