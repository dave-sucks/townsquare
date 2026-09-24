import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import type { PlaceListData } from "@/lib/agent/place-row";
import { getMyPlaces, resolveArea, summarizePlaces } from "@/lib/places/query";

export const getMyPlacesTool = defineTool({
  description:
    "The user's own saved places: their want-to-go list, places they've been, or one of their named lists. " +
    "Use for \"what's on my want-to-go near here?\", \"where have I been in the West Village?\", \"what's on my Date Night list?\". " +
    "Defaults to all saves anywhere; pass area to narrow to the map or a neighborhood.",
  schema: z.object({
    filter: z
      .enum(["all", "want_to_go", "been", "list"])
      .optional()
      .describe('"want_to_go" (saved, not been), "been", "list" (needs listName), or "all" (default).'),
    listName: z.string().optional().describe('Name of one of the user\'s lists, e.g. "Date Night". Required when filter is "list".'),
    area: z
      .string()
      .optional()
      .describe('"anywhere" (default), "bounds" (the map view), "near_me", or a neighborhood/city name.'),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  ui: "place-list",
  progressLabel: (args) => TOOL_LABELS.get_my_places(args),
  execute: async ({ filter = "all", listName, area, limit }, ctx) => {
    const resolved = resolveArea(area ?? "anywhere", ctx);
    const result = await getMyPlaces({
      userId: ctx.userId,
      filter,
      listName,
      area: resolved,
      limit: limit ?? 12,
      location: ctx.location,
    });

    if (!result.listFound) {
      const lists = await prisma.list.findMany({ where: { userId: ctx.userId }, select: { name: true } });
      const names = lists.map((l) => `"${l.name}"`).join(", ") || "none yet";
      return {
        ui: "tool-ui" as const,
        summary: `No list named "${listName ?? ""}". The user's lists: ${names}.`,
        data: { items: [{ kind: "generic" as const, text: `No list called "${listName ?? ""}" — your lists: ${names}` }] },
      };
    }

    const scopeLabel =
      filter === "want_to_go"
        ? "want-to-go"
        : filter === "been"
          ? "been"
          : filter === "list"
            ? `list: ${result.listName}`
            : "saved";
    const data: PlaceListData = {
      query: result.listName ?? scopeLabel,
      scope: scopeLabel,
      places: result.places,
      total: result.total,
      truncated: result.total > result.places.length,
    };
    const lead = `The user's ${scopeLabel} places ${resolved.label} (${result.total} total${data.truncated ? `, showing ${result.places.length}` : ""})`;
    return { summary: summarizePlaces(result.places, lead), data };
  },
});
