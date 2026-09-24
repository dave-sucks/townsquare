/**
 * ToolResult — canonical shape for all agent tool returns.
 *
 * Ported from Hindsight lib/agent/tool-result.ts. Every tool using
 * defineTool() returns one of these. The `ui` field is a discriminator that
 * ToolCallRow reads to pick a renderer.
 *
 * Renderer architecture — the list is SHORT and CLOSED:
 *   "tool-ui"      → ToolUIRenderer — the ONE generic renderer. Reads
 *                    data.items[] (place / person / generic rows) and shows
 *                    them as quiet chain-of-thought steps. Most tools.
 *   "place-list"   → PlaceListRenderer — the loud one: the place answer,
 *                    synced with the map. data: PlaceListData.
 *   "ask-question" → AskQuestionRenderer — clarifying question + quick replies.
 *
 * DO NOT add new UI values for list-shaped tools. Hindsight built and then
 * deleted six one-off renderers. A new shape is a new ToolUIItem kind.
 */

import type { PlaceListData, PlaceRow } from "./place-row";

// ── UI discriminator ─────────────────────────────────────────────────────────

export type ToolUI = "tool-ui" | "place-list" | "ask-question";

// ── Unified item model for ToolUIRenderer ────────────────────────────────────

/**
 * A single row inside a tool step. Every list-shaped "tool-ui" tool returns
 * an array of these on `data.items`:
 *   - "place"   → 16px photo/emoji + bold name + " — " text
 *   - "person"  → 16px avatar + @handle + text
 *   - "generic" → dot + text. Prose is always generic — a place row is only
 *                 for a real Place (Hindsight's fake "$MARKET" ticker lesson).
 */
export type ToolUIItem =
  | {
      kind: "place";
      placeId: string | null;
      googlePlaceId: string;
      name: string;
      emoji?: string | null;
      photoRef?: string | null;
      text?: string;
    }
  | {
      kind: "person";
      userId: string;
      username: string;
      avatar?: string | null;
      isFollowed?: boolean;
      text?: string;
    }
  | { kind: "generic"; text: string };

// ── Source attribution ───────────────────────────────────────────────────────

export interface ToolSource {
  provider: string;
  title: string;
  url?: string;
  excerpt?: string;
}

// ── Result shape ─────────────────────────────────────────────────────────────

export type ToolResult<T = unknown> =
  | {
      ok: true;
      ui: ToolUI;
      /** Phase groupId — consecutive tools with same groupId collapse in UI */
      groupId?: string;
      /**
       * Human-readable, present-tense gerund label describing what this
       * tool call is DOING — shown in the row + used to derive the group
       * header. Falls back to the tool name when absent. Examples:
       *   "Finding burger spots your people posted near you"
       *   "Reading @girlgottaeatz's recent posts"
       */
      progressLabel?: string;
      summary: string;
      data: T;
      sources: ToolSource[];
    }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      sources: ToolSource[];
    };

export type ToolUIData = { items: ToolUIItem[] };
export type { PlaceListData, PlaceRow };

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Coerce whatever a tool part carries into the ToolResult shape. Used by
 * ToolCallRow for replay: legacy conversations carry synthesized
 * place-list envelopes (convert-messages.ts), and anything malformed falls
 * back to a generic row instead of throwing.
 */
export function normalizeToolResult(toolName: string, raw: unknown): ToolResult {
  if (raw == null) {
    return { ok: true, ui: inferToolUI(toolName), summary: "Complete", data: null, sources: [] };
  }

  if (typeof raw === "object" && "ok" in (raw as object)) {
    const r = raw as ToolResult;
    if (r.ok) {
      const ui: ToolUI =
        r.ui === "place-list" || r.ui === "ask-question" || r.ui === "tool-ui" ? r.ui : "tool-ui";
      return { ...r, ui, sources: Array.isArray(r.sources) ? r.sources : [] };
    }
    return { ...r, sources: Array.isArray(r.sources) ? r.sources : [] };
  }

  const r = raw as Record<string, unknown>;
  if (typeof r.error === "string" && !r.summary) {
    return { ok: false, error: r.error, retryable: false, sources: [] };
  }
  return {
    ok: true,
    ui: "tool-ui",
    summary: typeof r.summary === "string" ? r.summary : "Complete",
    data: r.data ?? r,
    sources: [],
  };
}

/** The renderer a tool uses before its result arrives (loading skeletons). */
export function inferToolUI(toolName: string): ToolUI {
  if (PLACE_LIST_TOOLS.has(toolName)) return "place-list";
  if (toolName === "ask_question") return "ask-question";
  return "tool-ui";
}

/** Tools whose answer is a place list (loud renderer, synced with the map). */
export const PLACE_LIST_TOOLS = new Set([
  "search_places",
  "places_from_people_i_follow",
  "search_google_places",
  "get_place",
  "get_creator",
  "get_my_places",
]);
