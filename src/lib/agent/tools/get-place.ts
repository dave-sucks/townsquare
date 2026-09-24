import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import type { PlaceListData } from "@/lib/agent/place-row";
import { getPlacePosts, hydratePlaceRows, resolveArea, resolvePlace } from "@/lib/places/query";

export const getPlaceTool = defineTool({
  description:
    "Deep dive on one place: what creators are saying about it. Returns the place, its AI summary, top tags, " +
    "the latest creator posts (caption, creator, likes, date, link) and the user's own save state. " +
    "Use for \"what's the story on Via Carota?\", \"what are people saying about X?\", or to follow up on a place from a list. " +
    "Pass placeId when you have it from an earlier result; otherwise name (plus area if the name is common).",
  schema: z.object({
    placeId: z.string().optional().describe("Townsquare placeId (or Google place id) from an earlier result."),
    name: z.string().optional().describe("The place's name, when there's no placeId."),
    area: z.string().optional().describe("Neighborhood or city to disambiguate a common name."),
  }),
  ui: "place-list",
  progressLabel: (args) => TOOL_LABELS.get_place(args),
  execute: async ({ placeId, name, area }, ctx) => {
    const resolved = await resolvePlace({
      placeId,
      name,
      area: area ? resolveArea(area, ctx) : undefined,
    });
    if (!resolved) {
      return {
        ui: "tool-ui" as const,
        summary: `No place named "${name ?? placeId}" on Townsquare. Try search_google_places to find it, or web_search for background.`,
        data: { items: [{ kind: "generic" as const, text: `Nothing on Townsquare called "${name ?? placeId}" yet` }] },
      };
    }

    const [places, posts, place] = await Promise.all([
      hydratePlaceRows([resolved.id], { userId: ctx.userId, scope: { kind: "all" }, location: ctx.location }),
      getPlacePosts(resolved.id, ctx.userId, 8),
      prisma.place.findUnique({ where: { id: resolved.id }, select: { aiSummary: true, name: true } }),
    ]);
    const row = places[0];

    const data: PlaceListData = {
      query: row?.name ?? name ?? "",
      scope: "place",
      places,
      total: places.length,
      truncated: false,
      aiSummary: place?.aiSummary ?? null,
      posts,
    };

    const lines = [
      `${row?.name}${row?.neighborhood ? ` (${row.neighborhood})` : ""} [placeId ${resolved.id}] — ${row?.category ?? ""} ${row?.priceLevel ?? ""}`.trim(),
      row?.tags?.length ? `Tags: ${row.tags.map((t) => t.displayName).join(", ")}` : "",
      place?.aiSummary ? `Summary: ${place.aiSummary}` : "",
      row?.mySave?.saved ? `The user has saved it${row.mySave.hasBeen ? " and has been" : " (want to go)"}.` : "The user hasn't saved it.",
      posts.length
        ? `Latest posts:\n${posts
            .map((p) => `- @${p.creator.username}${p.creator.isFollowed ? " (followed)" : ""}${p.postedAt ? `, ${p.postedAt.slice(0, 10)}` : ""}${p.likes != null ? `, ${p.likes} likes` : ""}: "${(p.caption ?? "").replace(/\s+/g, " ").slice(0, 220)}"`)
            .join("\n")}`
        : "No creator posts yet.",
      resolved.alternatives.length ? `Other places with a similar name: ${resolved.alternatives.join("; ")}` : "",
    ].filter(Boolean);

    return { summary: lines.join("\n"), data };
  },
});
