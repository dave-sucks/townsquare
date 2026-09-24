import { z } from "zod";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import type { PlaceListData } from "@/lib/agent/place-row";
import { getCreatorByHandle, getCreatorPlaces, resolveArea, summarizePlaces } from "@/lib/places/query";

export const getCreatorTool = defineTool({
  description:
    "A creator's profile and the places they've posted, most recent first. " +
    "Use for \"where has @someinfluencer been lately?\" or \"what does @handle recommend in Brooklyn?\".",
  schema: z.object({
    handle: z.string().describe("The creator's @handle (with or without @)."),
    area: z.string().optional().describe('Optional: narrow to "bounds", "near_me", or a neighborhood/city. Default anywhere.'),
    limit: z.number().int().min(1).max(12).optional(),
  }),
  ui: "place-list",
  progressLabel: (args) => TOOL_LABELS.get_creator(args),
  execute: async ({ handle, area, limit }, ctx) => {
    const creator = await getCreatorByHandle(handle, ctx.userId);
    if (!creator) {
      const h = handle.replace(/^@/, "");
      return {
        ui: "tool-ui" as const,
        summary: `No creator @${h} on Townsquare. find_creators can suggest who posts about a topic; web_search can look them up.`,
        data: { items: [{ kind: "generic" as const, text: `@${h} isn't on Townsquare yet` }] },
      };
    }
    const resolved = resolveArea(area ?? "anywhere", ctx);
    const { places, total } = await getCreatorPlaces({
      creatorId: creator.id,
      viewerId: ctx.userId,
      area: resolved,
      limit: limit ?? 12,
      location: ctx.location,
    });
    const data: PlaceListData = {
      query: `@${creator.username}`,
      scope: "creator",
      places,
      total,
      truncated: total > places.length,
      creator,
    };
    const lead =
      `@${creator.username}${creator.displayName ? ` (${creator.displayName})` : ""} — ${creator.postCount} posts across ${creator.placeCount} places, ` +
      `${creator.followerCount} followers on Townsquare, ${creator.isFollowed ? "the user follows them" : "the user doesn't follow them"}.` +
      `${creator.bio ? ` Bio: ${creator.bio}` : ""}\nTheir places ${resolved.label}, most recent first`;
    return { summary: summarizePlaces(places, lead), data };
  },
});
