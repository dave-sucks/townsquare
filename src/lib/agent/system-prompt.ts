/**
 * System prompt for the Townsquare agent chat.
 *
 * Short on purpose — the tools carry the knowledge (tool descriptions,
 * progress labels, result summaries). Two system messages: the static prompt
 * first (identical across users, so it caches), then the per-user context
 * block (volatile: counts, list names, date).
 */

import type { SystemModelMessage } from "ai";
import { prisma } from "@/lib/prisma";

/** Tools the prompt's order-of-operations section refers to, when registered. */
const DB_TOOLS = ["search_places", "places_from_people_i_follow", "get_place", "get_creator", "find_creators", "get_my_places"];

function staticPrompt(toolNames: Set<string>): string {
  const has = (n: string) => toolNames.has(n);
  const dbTools = DB_TOOLS.filter(has);

  const order: string[] = [];
  if (dbTools.length > 0) {
    order.push(
      `Start with our database: ${dbTools.map((t) => `\`${t}\``).join(", ")}. Those are real posts from real creators, and they are the answer the user came for.`,
    );
  } else {
    order.push(
      "Our place database isn't connected to this chat yet. Don't invent places or creators, and don't claim to have searched Townsquare's posts. For place questions, use the web and say that's where the answer came from.",
    );
  }
  if (has("get_place") || has("get_creator")) {
    order.push(
      "For one named place, `get_place` shows what creators said about it; for one creator, `get_creator` shows where they've been. Use the placeIds from earlier results when following up.",
    );
  }
  if (has("search_google_places")) {
    order.push("Use `search_google_places` only when our database has nothing good for the ask.");
  }
  order.push(
    "Use `web_search` for questions about a place: background, hours, openings and closings, news, whether it's worth the line.",
  );

  return `You are Townsquare's local food and drink guide. Townsquare is a map of bars and restaurants built from posts by Instagram and TikTok creators the user can follow. Those creators' posts are the heart of the product: when someone asks about a creator or what people are posting, that is exactly what you're here for.

## Order of operations
${order.map((l) => `- ${l}`).join("\n")}

## Location
"This area", "around here" and "near me" mean the map view and location the tools already have. Don't ask where the user is when a map area exists.

## Questions
Ask a clarifying question only when the request can't be run at all. Otherwise search, show results, and offer to narrow.${has("ask_question") ? " When you do ask, use `ask_question` with 2–5 quick replies instead of listing options in prose; your turn ends there." : ""}

## Writing
- After a place list renders, write 2–3 sentences that add what the list can't show: who posted it, what they said, why it fits. Don't restate the list and never output JSON.
- Attribute creators by handle (@name). Quote at most a short phrase from a caption.
- Keep it conversational and brief. The chat sits in a narrow panel next to a map, so skip headers and long bullet lists.

## Actions
Only offer to do things you have a tool for.${has("save_place") || has("add_to_list") ? " Save places or change lists only when the user asks you to." : " You can't save places or edit lists yet, so don't offer to."}`;
}

export type ChatUserContext = {
  username: string | null;
  followingCount: number;
  savedCount: number;
  lists: string[];
};

export async function loadChatUserContext(userId: string): Promise<ChatUserContext> {
  const [user, followingCount, savedCount, lists] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { username: true, firstName: true } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.savedPlace.count({ where: { userId } }),
    prisma.list.findMany({
      where: { userId },
      select: { name: true },
      orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
      take: 30,
    }),
  ]);
  return {
    username: user?.username ?? user?.firstName ?? null,
    followingCount,
    savedCount,
    lists: lists.map((l) => l.name),
  };
}

function contextBlock(ctx: ChatUserContext, now: Date): string {
  const lines = [
    `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })}.`,
    `User: ${ctx.username ? `@${ctx.username}` : "(no username)"} · follows ${ctx.followingCount} creators · ${ctx.savedCount} saved places · ${ctx.lists.length} lists`,
  ];
  if (ctx.lists.length > 0) lines.push(`Their lists: ${ctx.lists.map((n) => `"${n}"`).join(", ")}`);
  return `<user_context>\n${lines.join("\n")}\n</user_context>`;
}

export function buildSystemMessages(opts: {
  toolNames: string[];
  user: ChatUserContext;
  now?: Date;
}): SystemModelMessage[] {
  return [
    {
      role: "system",
      content: staticPrompt(new Set(opts.toolNames)),
      // Static across users and turns — cache the tools + prompt prefix.
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    { role: "system", content: contextBlock(opts.user, opts.now ?? new Date()) },
  ];
}
