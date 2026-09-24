import { z } from "zod";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import { savePlaceForUser } from "@/lib/places/save";

export const savePlaceTool = defineTool({
  description:
    "WRITE: save a place to the user's want-to-go, or mark it as been (optionally with a rating). " +
    "Only when the user asks you to save, mark or rate something.",
  schema: z.object({
    placeId: z.string().describe("The placeId from an earlier result."),
    status: z.enum(["want_to_go", "been"]).describe('"want_to_go" to save it, "been" to mark it visited.'),
    rating: z
      .enum(["ehh", "liked", "loved"])
      .optional()
      .describe('Only with status "been": the user\'s verdict.'),
  }),
  ui: "tool-ui",
  progressLabel: (args) => TOOL_LABELS.save_place(args),
  execute: async ({ placeId, status, rating }, ctx) => {
    const { place, saved, hasBeen } = await savePlaceForUser({ userId: ctx.userId, placeId, status, rating });
    const photoRef = Array.isArray(place.photoRefs) ? (place.photoRefs[0] as string | undefined) ?? null : null;
    const text = hasBeen ? `Marked been${rating ? ` · ${rating}` : ""}` : "Saved to want-to-go";
    return {
      progressLabel: hasBeen ? `Marking ${place.name} as been` : `Saving ${place.name}`,
      summary: `${hasBeen ? "Marked" : "Saved"} ${place.name}${hasBeen ? ` as been${rating ? ` (${rating})` : ""}` : " to want-to-go"}.`,
      data: {
        items: [
          {
            kind: "place" as const,
            placeId: place.id,
            googlePlaceId: place.googlePlaceId,
            name: place.name,
            emoji: saved.emoji,
            photoRef,
            text,
          },
        ],
      },
    };
  },
});
