import { z } from "zod";
import type { FieldContract } from "../contract";

export const summarizeSchema = z.object({
  summary: z.string(),
  knownFor: z.array(z.string()),
});

export type SummarizeOutput = z.infer<typeof summarizeSchema>;

export const SUMMARIZE_FIELDS: FieldContract = {
  summary: { kind: "TEXT", rule: "Two plain, specific sentences from the mentions." },
  "knownFor[]": {
    kind: "JUDGED",
    rule: "At most three dishes, each from the dish list given; the gate drops any other.",
    marker: "come only from the dish list you are given",
  },
  verdictCounts: { kind: "COMPUTED", rule: "Counted by Aggregate." },
};
