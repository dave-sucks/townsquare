import { z } from "zod";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import type { PlaceListData } from "@/lib/agent/place-row";
import { googleTextSearch, persistGooglePlaces } from "@/lib/places/google";
import { hydratePlaceRows, resolveArea, summarizePlaces } from "@/lib/places/query";

export const searchGooglePlacesTool = defineTool({
  description:
    "Fallback: search Google for places Townsquare doesn't have yet. Use ONLY after search_places / " +
    "places_from_people_i_follow came back empty or thin, or when the user names a specific place we don't have. " +
    "Results are real places the user can save, but no creator has posted them.",
  schema: z.object({
    query: z.string().describe('What to find, e.g. "natural wine bar", or a place name like "Via Carota".'),
    area: z
      .string()
      .optional()
      .describe('"bounds" (default: the map view), "near_me", or a neighborhood/city name.'),
  }),
  ui: "place-list",
  progressLabel: (args) => TOOL_LABELS.search_google_places(args),
  execute: async ({ query, area }, ctx) => {
    const resolved = resolveArea(area, ctx);
    let near: { lat: number; lng: number } | undefined;
    let radiusMeters: number | undefined;
    let text = query;
    if (resolved.kind === "bbox") {
      near = { lat: (resolved.north + resolved.south) / 2, lng: (resolved.east + resolved.west) / 2 };
      // Half the box diagonal, capped — Text Search treats radius as a bias.
      const latM = (resolved.north - resolved.south) * 111_000;
      radiusMeters = Math.min(20_000, Math.max(800, Math.round(latM * 0.7)));
    } else if (resolved.kind === "named") {
      text = `${query} in ${resolved.name}`;
    }

    const results = await googleTextSearch(text, { near, radiusMeters, limit: 6 });
    const ids = await persistGooglePlaces(results);
    const places = (
      await hydratePlaceRows(ids, { userId: ctx.userId, scope: { kind: "all" }, location: ctx.location })
    ).map((p) => (p.creators && p.creators.length > 0 ? p : { ...p, why: "Not posted by anyone on Townsquare yet" }));

    const data: PlaceListData = { query, scope: "google", places, total: places.length, truncated: false };
    return { summary: summarizePlaces(places, `Google results for "${query}" ${resolved.label}`), data };
  },
});
