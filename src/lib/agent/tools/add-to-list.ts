import { z } from "zod";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import { addPlacesToList } from "@/lib/places/save";

export const addToListTool = defineTool({
  description:
    "WRITE: add one or more places to one of the user's lists, creating the list if it doesn't exist. " +
    "Only when the user asks (\"save the top three to my Date Night list\"). Use placeIds from earlier results.",
  schema: z.object({
    listName: z.string().describe("The list's name. Matches an existing list case-insensitively; otherwise a new list is created."),
    placeIds: z.array(z.string()).min(1).max(20).describe("placeIds from earlier results, in the order to add them."),
  }),
  ui: "tool-ui",
  progressLabel: (args) => TOOL_LABELS.add_to_list(args),
  execute: async ({ listName, placeIds }, ctx) => {
    const { list, created, results } = await addPlacesToList({ userId: ctx.userId, listName, placeIds });
    const added = results.filter((r) => r.added).length;
    return {
      progressLabel:
        added > 0
          ? `Adding ${added === 1 ? "1 place" : `${added} places`} to ${list.name}`
          : `Checking your ${list.name} list`,
      summary:
        `${created ? `Created the list "${list.name}" and added` : `Added`} ${added} place${added === 1 ? "" : "s"} to "${list.name}"` +
        (results.length > added ? ` (${results.length - added} already on it)` : "") +
        (results.length < placeIds.length ? `; ${placeIds.length - results.length} placeId(s) weren't found` : "") +
        ".",
      data: {
        list,
        items: results.map((r) => ({
          kind: "place" as const,
          placeId: r.placeId,
          googlePlaceId: r.googlePlaceId,
          name: r.name,
          emoji: r.emoji,
          photoRef: r.photoRef,
          text: r.added ? `Added to ${list.name}` : `Already on ${list.name}`,
        })),
      },
    };
  },
});
