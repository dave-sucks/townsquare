import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import type { PlaceListData } from "@/lib/agent/place-row";
import { prisma } from "@/lib/prisma";
import { findPlaces, resolveArea, summarizePlaces } from "@/lib/places/query";
import { placeSearchSchema } from "./search-places";

export const placesFromPeopleIFollowTool = defineTool({
  description:
    "Like search_places, but only places posted by creators the user follows — the per-account ask: " +
    "\"burger spots from people I follow in this area\". Names only followed creators. " +
    "If the user follows nobody it says so; it never falls back to everyone's posts.",
  schema: placeSearchSchema,
  ui: "place-list",
  progressLabel: (args) => TOOL_LABELS.places_from_people_i_follow(args),
  execute: async ({ query, area, sort, limit }, ctx) => {
    const following = await prisma.follow.count({ where: { followerId: ctx.userId } });
    if (following === 0) {
      return {
        ui: "tool-ui" as const,
        summary:
          "The user doesn't follow any creators yet, so there's nothing to search. Offer find_creators to suggest people to follow.",
        data: {
          items: [
            { kind: "generic" as const, text: "You don't follow anyone yet — I can find creators who post about this." },
          ],
        },
      };
    }

    const resolved = resolveArea(area, ctx);
    const { places, total, matchedOn } = await findPlaces({
      query,
      area: resolved,
      scope: { kind: "following", userId: ctx.userId },
      sort,
      limit: limit ?? 8,
      userId: ctx.userId,
      location: ctx.location,
    });
    const data: PlaceListData = { query, scope: "following", places, total, truncated: total > places.length };
    const lead = `Places for "${query}" ${resolved.label} posted by creators the user follows (${total} match${total === 1 ? "" : "es"}${data.truncated ? `, top ${places.length}` : ""})`;
    const note = matchedOn ? ` (no exact match for "${query}"; matched on ${matchedOn})` : "";
    return { summary: summarizePlaces(places, lead + note), data };
  },
});
