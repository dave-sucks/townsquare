import { z } from "zod";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import type { PlaceListData } from "@/lib/agent/place-row";
import { findPlaces, resolveArea, summarizePlaces } from "@/lib/places/query";

export const placeSearchSchema = z.object({
  query: z
    .string()
    .describe('What to find, as a short keyword or phrase: "burgers", "natural wine", "date night", "late night pizza".'),
  area: z
    .string()
    .optional()
    .describe(
      '"bounds" (the map view — the default, and what "this area"/"around here" mean), "near_me", "anywhere", or a neighborhood/city name like "Williamsburg".',
    ),
  sort: z
    .enum(["most_posted", "trending", "closest"])
    .optional()
    .describe('"most_posted" (default: most creators, then posts), "trending" (recent posts), "closest" (needs the user\'s location).'),
  limit: z.number().int().min(1).max(12).optional(),
});

export const searchPlacesTool = defineTool({
  description:
    "Search Townsquare's places — bars and restaurants that creators have posted about — by what and where. " +
    "This is the primary tool for any place question. Matches tags, names and creators' captions; " +
    "ranks by how many distinct creators posted a place. Returns places with who posted them, their latest post, " +
    "tags, and the user's own save state. The list renders for the user and syncs with the map.",
  schema: placeSearchSchema,
  ui: "place-list",
  progressLabel: (args) => TOOL_LABELS.search_places(args),
  execute: async ({ query, area, sort, limit }, ctx) => {
    const resolved = resolveArea(area, ctx);
    const { places, total, matchedOn } = await findPlaces({
      query,
      area: resolved,
      scope: { kind: "all" },
      sort,
      limit: limit ?? 8,
      userId: ctx.userId,
      location: ctx.location,
    });
    const data: PlaceListData = { query, scope: "all", places, total, truncated: total > places.length };
    const lead = `Townsquare places for "${query}" ${resolved.label} (${total} match${total === 1 ? "" : "es"}${data.truncated ? `, top ${places.length}` : ""})`;
    const note = matchedOn ? ` (no exact match for "${query}"; matched on ${matchedOn})` : "";
    return { summary: summarizePlaces(places, lead + note), data };
  },
});
