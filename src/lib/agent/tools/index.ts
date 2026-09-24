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
import { getPlaceTool } from "./get-place";
import { getCreatorTool } from "./get-creator";
import { searchGooglePlacesTool } from "./search-google-places";
import { savePlaceTool } from "./save-place";
import { addToListTool } from "./add-to-list";
import { askQuestion } from "./ask-question";

export function createChatTools(ctx: ToolContext) {
  return {
    search_places: searchPlacesTool(ctx),
    places_from_people_i_follow: placesFromPeopleIFollowTool(ctx),
    find_creators: findCreatorsTool(ctx),
    get_my_places: getMyPlacesTool(ctx),
    get_place: getPlaceTool(ctx),
    get_creator: getCreatorTool(ctx),
    search_google_places: searchGooglePlacesTool(ctx),
    save_place: savePlaceTool(ctx),
    add_to_list: addToListTool(ctx),
    ask_question: askQuestion(ctx),
  };
}
