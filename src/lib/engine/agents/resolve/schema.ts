import { z } from "zod";
import { CONFIDENCE_BUCKETS, type FieldContract } from "../contract";

/**
 * Candidates are offered as short ids (c1…c5) rather than Google place ids;
 * code maps the choice back.
 */
export function resolveSchema(candidateIds: string[]) {
  const choices: [string, ...string[]] = ["none", ...candidateIds];
  return z.object({
    choice: z.enum(choices),
    confidence: z.enum(CONFIDENCE_BUCKETS),
    reason: z.string(),
  });
}

export type ResolveOutput = z.infer<ReturnType<typeof resolveSchema>>;

export const RESOLVE_FIELDS: FieldContract = {
  choice: {
    kind: "IDENTITY",
    rule: "One of the candidate ids offered, or none; an enum of exactly those ids on the wire.",
  },
  confidence: { kind: "CHOSEN", rule: "How sure the pick is. Only high is accepted without a person." },
  reason: { kind: "TEXT", rule: "Why this candidate, or why none." },
  googlePlaceId: { kind: "COMPUTED", rule: "Auto-accepted matches never reach the model." },
};
