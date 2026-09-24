/**
 * Chain-of-thought labels for every chat tool, from its args.
 *
 * One table for both sides: defineTool uses it for the result's
 * `progressLabel`, and the thread uses it while a call is still running
 * (before any result exists). Present-tense gerunds that read like a line
 * of thought. Client-safe — no server imports.
 */

type Args = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function areaPhrase(area: unknown): string {
  const a = str(area)?.toLowerCase();
  if (!a || a === "bounds" || a === "this area" || a === "map") return " in this area";
  if (a === "near_me" || a === "near me" || a === "nearby") return " near you";
  if (a === "anywhere" || a === "all") return "";
  return ` in ${str(area)}`;
}

export const TOOL_LABELS: Record<string, (args: Args) => string> = {
  find_creators: (a) => `Finding creators who post about ${str(a.query) ?? "this"}${areaPhrase(a.area)}`,
  get_my_places: (a) => {
    switch (a.filter) {
      case "want_to_go":
        return "Checking your want-to-go list";
      case "been":
        return "Checking places you've been";
      case "list":
        return `Opening your ${str(a.listName) ?? ""} list`.replace("  ", " ");
      default:
        return "Checking your saved places";
    }
  },
  search_places: (a) => `Searching Townsquare for ${str(a.query) ?? "places"}${areaPhrase(a.area)}`,
  places_from_people_i_follow: (a) =>
    `Finding ${str(a.query) ?? "places"} from people you follow${areaPhrase(a.area)}`,
  get_place: (a) => `Reading what people say about ${str(a.name) ?? "this place"}`,
  get_creator: (a) => `Reading @${(str(a.handle) ?? "creator").replace(/^@/, "")}'s recent posts`,
  search_google_places: (a) => `Looking beyond Townsquare for ${str(a.query) ?? "places"}`,
  save_place: (a) => (a.status === "been" ? "Marking it as been" : "Saving to your want-to-go"),
  add_to_list: (a) => {
    const n = Array.isArray(a.placeIds) ? a.placeIds.length : 0;
    return `Adding ${n === 1 ? "1 place" : `${n} places`} to ${str(a.listName) ?? "your list"}`;
  },
  ask_question: () => "Asking a quick question",
  web_search: (a) => `Searching the web${str(a.query) ? ` for "${str(a.query)}"` : ""}`,
};

export function toolLabel(toolName: string, args: Args | undefined): string {
  const f = TOOL_LABELS[toolName];
  if (f) {
    try {
      return f(args ?? {});
    } catch {
      /* fall through */
    }
  }
  return toolName.replace(/_/g, " ");
}
