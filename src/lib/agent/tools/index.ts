/**
 * createChatTools(ctx) — every tool the chat agent can call, bound to this
 * request's context. Anthropic's server-side web_search is added in the
 * route (it isn't a defineTool).
 */

import type { ToolContext } from "@/lib/agent/tool-context";
import { findCreatorsTool } from "./find-creators";
import { getMyPlacesTool } from "./get-my-places";
import { searchPlacesTool } from "./search-places";
import { placesFromPeopleIFollowTool } from "./places-from-people-i-follow";

export function createChatTools(ctx: ToolContext) {
  return {
    search_places: searchPlacesTool(ctx),
    places_from_people_i_follow: placesFromPeopleIFollowTool(ctx),
    find_creators: findCreatorsTool(ctx),
    get_my_places: getMyPlacesTool(ctx),
  };
}
