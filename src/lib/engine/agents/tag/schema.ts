import { z } from "zod";
import { CONFIDENCE_BUCKETS, type FieldContract } from "../contract";

/** The slug enum is the active taxonomy, read from the database per call. */
export function tagSchema(slugs: string[], categories: string[]) {
  return z.object({
    tags: z.array(
      z.object({
        slug: z.enum(slugs as [string, ...string[]]),
        confidence: z.enum(CONFIDENCE_BUCKETS),
        evidence: z
          .string()
          .describe(
            'Copied exactly from the <mention> or <place> block: a phrase from the excerpt, a dish name, or a whole fact line such as "Google types: bakery, cafe". A quote, not an explanation.',
          ),
      }),
    ),
    suggestions: z.array(
      z.object({
        label: z.string(),
        category: z.enum(categories as [string, ...string[]]),
        evidence: z.string().describe("The words in the mention that call for this tag."),
      }),
    ),
  });
}

/**
 * What code accepts back: the same shape with free strings, so one slug
 * outside the taxonomy is dropped by the gate instead of failing the call.
 */
export const tagParseSchema = z.object({
  tags: z.array(z.object({ slug: z.string(), confidence: z.enum(CONFIDENCE_BUCKETS), evidence: z.string() })),
  suggestions: z.array(z.object({ label: z.string(), category: z.string(), evidence: z.string() })),
});

export type TagOutput = z.infer<typeof tagParseSchema>;

export const TAG_FIELDS: FieldContract = {
  "tags[].slug": { kind: "CHOSEN", rule: "An active tag's slug." },
  "tags[].confidence": { kind: "CHOSEN", rule: "high and medium are kept; low is dropped." },
  "tags[].evidence": {
    kind: "JUDGED",
    rule: "A quote from the mention (excerpt, dishes) or a place-fact line; the gate checks it is a substring.",
    marker: "needs evidence in the excerpt",
  },
  "suggestions[].label": { kind: "TEXT", rule: "A tag the taxonomy lacks." },
  "suggestions[].category": { kind: "CHOSEN", rule: "Which category the suggestion belongs to." },
  "suggestions[].evidence": { kind: "TEXT", rule: "The words that suggest it." },
  "tags[].confidenceValue": { kind: "COMPUTED", rule: "high 0.9, medium 0.6." },
};
