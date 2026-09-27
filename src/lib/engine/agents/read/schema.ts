import { z } from "zod";
import { CONFIDENCE_BUCKETS, type FieldContract } from "../contract";

export const POST_TYPES = ["single_place", "roundup", "guide", "not_a_place", "other"] as const;
export const READ_EVIDENCE = [
  "caption",
  "location_tag",
  "tagged_account",
  "creator_comment",
  "transcript",
  "on_screen_text",
  "image",
] as const;
export const MENTION_ROLES = ["primary", "list_item", "passing"] as const;
export const VERDICTS = ["loved", "liked", "mixed", "disliked", "none"] as const;
export const DISH_SENTIMENTS = ["positive", "neutral", "negative"] as const;

export const readPlaceSchema = z.object({
  name: z.string(),
  evidence: z.array(z.enum(READ_EVIDENCE)),
  taggedAccount: z.string().nullable(),
  addressHint: z.string().nullable(),
  areaHint: z.string().nullable(),
  role: z.enum(MENTION_ROLES),
  excerpt: z.string(),
  excerptSource: z.enum(["caption", "transcript"]),
  dishes: z.array(z.object({ name: z.string(), sentiment: z.enum(DISH_SENTIMENTS) })),
  verdict: z.enum(VERDICTS),
  score: z.string().nullable(),
  confidence: z.enum(CONFIDENCE_BUCKETS),
  missing: z.string().nullable(),
});

export const readSchema = z.object({
  postType: z.enum(POST_TYPES),
  notPlaceReason: z.string().nullable(),
  sponsored: z.boolean(),
  places: z.array(readPlaceSchema),
});

export type ReadOutput = z.infer<typeof readSchema>;
export type ReadPlace = z.infer<typeof readPlaceSchema>;

export const READ_FIELDS: FieldContract = {
  postType: { kind: "CHOSEN", rule: "What kind of post this is." },
  notPlaceReason: { kind: "TEXT", rule: "Why a not_a_place post has no places." },
  sponsored: { kind: "CHOSEN", rule: "The post discloses a paid partnership, gifted meal or ad." },
  "places[].name": { kind: "TEXT", rule: "The place's name as the post writes it." },
  "places[].evidence[]": { kind: "CHOSEN", rule: "Which signals support the place." },
  "places[].taggedAccount": {
    kind: "IDENTITY",
    rule: "The place's Instagram account; the gate checks the post actually tags or @mentions it.",
  },
  "places[].addressHint": { kind: "TEXT", rule: "A street or address the post gives." },
  "places[].areaHint": { kind: "TEXT", rule: "A neighborhood or city the post gives." },
  "places[].role": { kind: "CHOSEN", rule: "The place's weight in the post." },
  "places[].excerpt": {
    kind: "JUDGED",
    rule: "A verbatim substring of the caption (or transcript) after whitespace normalization; the gate checks it.",
    marker: "copied word for word",
  },
  "places[].excerptSource": { kind: "CHOSEN", rule: "Where the excerpt was copied from." },
  "places[].dishes[].name": { kind: "TEXT", rule: "A dish the creator names." },
  "places[].dishes[].sentiment": { kind: "CHOSEN", rule: "How the creator felt about the dish." },
  "places[].verdict": { kind: "CHOSEN", rule: "The creator's overall verdict on the place." },
  "places[].score": {
    kind: "JUDGED",
    rule: "A score exactly as written (\"8.5/10\"); the gate checks it appears in the post. Code parses value and scale.",
    marker: "any score exactly as they wrote it",
  },
  "places[].confidence": { kind: "CHOSEN", rule: "How sure the model is that the post is about this place." },
  "places[].missing": { kind: "TEXT", rule: "What a person needs to finish a low-confidence place." },
  // Decided in code, never by the model:
  "places[].score.value": { kind: "COMPUTED", rule: "Parsed from score." },
  "places[].score.outOf": { kind: "COMPUTED", rule: "Parsed from score." },
  "places[].confidenceValue": { kind: "COMPUTED", rule: "high 0.9, medium 0.6, low 0.3." },
  "places[].placeId": { kind: "COMPUTED", rule: "Set by Resolve." },
};
