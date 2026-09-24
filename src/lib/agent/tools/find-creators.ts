import { z } from "zod";
import { defineTool } from "@/lib/agent/define-tool";
import { TOOL_LABELS } from "@/lib/agent/tool-labels";
import type { ToolUIItem } from "@/lib/agent/tool-result";
import { findCreators, resolveArea } from "@/lib/places/query";

export const findCreatorsTool = defineTool({
  description:
    "Find creators on Townsquare who post about something, ranked by how many matching posts they have in an area. " +
    "Use for \"who should I follow for tacos in Brooklyn?\" or \"who posts about natural wine?\". " +
    "Returns each creator's handle, post count, a few places they've posted, and whether the user already follows them.",
  schema: z.object({
    query: z.string().describe('What they post about, as a short keyword: "tacos", "natural wine", "omakase".'),
    area: z
      .string()
      .optional()
      .describe('"bounds" (the map view, default), "near_me", "anywhere", or a neighborhood/city name like "Williamsburg".'),
    limit: z.number().int().min(1).max(10).optional(),
  }),
  ui: "tool-ui",
  groupId: "Finding creators",
  progressLabel: (args) => TOOL_LABELS.find_creators(args),
  execute: async ({ query, area, limit }, ctx) => {
    const resolved = resolveArea(area, ctx);
    const creators = await findCreators({ query, area: resolved, userId: ctx.userId, limit: limit ?? 6 });

    const items: ToolUIItem[] = creators.map((c) => ({
      kind: "person",
      userId: c.userId,
      username: c.username,
      avatar: c.avatar,
      isFollowed: c.isFollowed,
      text: `${c.posts} ${c.posts === 1 ? "post" : "posts"}${c.topPlaces.length ? ` · ${c.topPlaces.join(", ")}` : ""}`,
    }));

    const summary =
      creators.length === 0
        ? `No creators have posted about "${query}" ${resolved.label}.`
        : `Creators posting about "${query}" ${resolved.label}:\n` +
          creators
            .map(
              (c, i) =>
                `${i + 1}. @${c.username} — ${c.posts} matching posts across ${c.places} places (${c.topPlaces.join(", ")})${c.isFollowed ? " · already followed" : " · not followed"}`,
            )
            .join("\n");

    return { summary, data: { items } };
  },
});
