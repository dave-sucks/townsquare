/**
 * Persisted chat → UIMessage[] for replaying a conversation via useChatRuntime.
 *
 * Ported from Hindsight lib/agent/convert-messages.ts. Two sources:
 *   - Conversation.uiMessages: the UIMessage[] /api/chat writes in onFinish.
 *     Hindsight persists [...clientUIMessages, ...responseModelMessages], so
 *     its converter also rebuilds UIMessages from ModelMessages; that branch
 *     is kept so a thread in either shape opens.
 *   - Legacy ChatMessage rows from the old /chat (flat text + a places blob):
 *     legacyChatMessagesToUIMessages() turns each places blob into a
 *     synthesized tool-search_places part so old chats render in the new UI.
 *
 * Output uses AI SDK v6 UIMessage format where tool parts are:
 *   { type: "tool-{toolName}", toolCallId, state: "output-available", input, output }
 *
 * The tool name is encoded in the `type` field (e.g. "tool-search_places"),
 * NOT as a separate `toolName` prop. assistant-ui's runtime extracts the name via
 * getStaticToolName() which does: type.split("-").slice(1).join("-").
 *
 * Unlike Hindsight's version, reasoning, source-url, source-document, file and
 * step-start parts pass through: townsquare's thread shows the thinking block
 * and web-search citations on a reloaded conversation.
 */

import type { UIMessage } from "ai";
import type { PlaceRow } from "./place-row";
import { getChatCategory } from "@/lib/places/category";

/**
 * Ids for the messages the writer never gave one to.
 *
 * A minted id cannot reuse one already in the payload, because **a minted id
 * comes back**: the agent route persists `[...clientUIMessages,
 * ...responseModelMessages]`, and the client's messages carry whatever ids
 * this file minted when the thread was last hydrated. So the stored thread
 * accumulates real `replay-N` ids, and a counter restarting at zero on the
 * next hydration hands `replay-0` to a NEW id-less message while an OLD one
 * still holds it. assistant-ui then refuses the whole thread — "a message
 * with the same id already exists in the parent tree" — and the chat renders
 * an error instead of the conversation.
 *
 * Seen live 2026-09-21 on a resumed chat (Hindsight #695): messages 1–3 were
 * stored carrying `replay-0`, `replay-1`, `replay-2` from an earlier
 * hydration, and the last three turns had been appended as raw ModelMessages
 * with no ids at all. Every reload reproduced it.
 *
 * Minting against the ids actually present fixes threads already in that
 * state, which is why it happens here rather than only at the write path.
 */
function makeIdMinter(raw: unknown[]): () => string {
  const taken = new Set<string>();
  for (const rawMsg of raw) {
    if (!rawMsg || typeof rawMsg !== "object") continue;
    const msg = rawMsg as Record<string, unknown>;
    if (typeof msg.id === "string") taken.add(msg.id);
    // Tool call ids are minted from the same well and collide the same way.
    const parts = Array.isArray(msg.parts) ? msg.parts : Array.isArray(msg.content) ? msg.content : [];
    for (const part of parts as Record<string, unknown>[]) {
      if (part && typeof part.toolCallId === "string") taken.add(part.toolCallId);
    }
  }
  let n = 0;
  return () => {
    let id = `replay-${n++}`;
    while (taken.has(id)) id = `replay-${n++}`;
    taken.add(id);
    return id;
  };
}

/**
 * Detect whether a raw message object is a UIMessage (has `parts`) or a
 * ModelMessage (has `content` as array with typed parts).
 */
function isUIMessage(msg: Record<string, unknown>): boolean {
  return Array.isArray(msg.parts);
}

/**
 * Unwrap a ToolResultOutput (from ModelMessage) to the raw tool result value.
 * ModelMessage tool-result parts store output as { type: "json"|"text", value: ... }.
 * UIMessage tool parts just store the raw value directly.
 */
function unwrapToolOutput(output: unknown): unknown {
  if (output && typeof output === "object" && "type" in output && "value" in output) {
    const wrapped = output as { type: string; value: unknown };
    if (wrapped.type === "json" || wrapped.type === "text") {
      return wrapped.value;
    }
  }
  // Already unwrapped or unknown format — return as-is
  return output;
}

/**
 * Build a v6 tool part with the correct type format.
 * AI SDK v6 uses `type: "tool-{toolName}"` (not "tool-invocation").
 */
function makeToolPart(opts: {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output?: unknown;
  state: string;
}): UIMessage["parts"][number] {
  return {
    type: `tool-${opts.toolName}`,
    toolCallId: opts.toolCallId,
    state: opts.state,
    input: opts.input,
    ...(opts.output !== undefined ? { output: opts.output } : {}),
  } as unknown as UIMessage["parts"][number];
}

/** Non-tool UIMessage parts that replay as-is. */
const PASSTHROUGH_PART_TYPES = new Set([
  "reasoning",
  "source-url",
  "source-document",
  "file",
  "step-start",
]);

/**
 * Convert the raw persisted JSON array into UIMessage[] that useChatRuntime
 * can accept as initialMessages with proper tool parts.
 */
export function convertPersistedToUIMessages(raw: unknown[]): UIMessage[] {
  const genId = makeIdMinter(raw);
  const result: UIMessage[] = [];
  // Track the current assistant UIMessage being built so we can attach
  // tool results from subsequent "tool" ModelMessages.
  let currentAssistant: UIMessage | null = null;

  for (const rawMsg of raw) {
    if (!rawMsg || typeof rawMsg !== "object") continue;
    const msg = rawMsg as Record<string, unknown>;

    // ── Already a UIMessage (from the client input) ──────────────────
    if (isUIMessage(msg)) {
      currentAssistant = null;
      const rawParts = msg.parts as Record<string, unknown>[];
      const parts: UIMessage["parts"] = [];
      for (const p of rawParts) {
        if (p.type === "text") {
          parts.push({ type: "text", text: p.text as string });
        } else if (typeof p.type === "string" && PASSTHROUGH_PART_TYPES.has(p.type)) {
          parts.push(p as unknown as UIMessage["parts"][number]);
        } else if (p.type === "tool-invocation") {
          // Legacy v5 format — convert to v6 "tool-{name}" format
          const toolName = p.toolName as string;
          parts.push(
            makeToolPart({
              toolName,
              toolCallId: (p.toolCallId as string) || genId(),
              input: p.args ?? p.input ?? {},
              output: p.result ?? p.output,
              state: p.state === "result" ? "output-available" : (p.state as string) ?? "output-available",
            }),
          );
        } else if (
          typeof p.type === "string" &&
          (p.type as string).startsWith("tool-")
        ) {
          // Already v6 format (type: "tool-{name}") — pass through with normalization.
          // Spread first so provider-executed tools (web_search) keep
          // providerExecuted / callProviderMetadata / errorText for replay.
          parts.push({
            ...p,
            type: p.type,
            toolCallId: (p.toolCallId as string) || genId(),
            state: p.state ?? "output-available",
            input: p.input ?? p.args ?? {},
            ...(p.output !== undefined ? { output: p.output } : {}),
            ...(p.result !== undefined && p.output === undefined ? { output: p.result } : {}),
          } as unknown as UIMessage["parts"][number]);
        }
      }
      result.push({
        id: (msg.id as string) || genId(),
        role: msg.role as UIMessage["role"],
        ...(msg.metadata !== undefined ? { metadata: msg.metadata } : {}),
        parts,
      });
      continue;
    }

    const role = msg.role as string;
    const content = msg.content as unknown;

    // ── User ModelMessage ────────────────────────────────────────────
    if (role === "user") {
      currentAssistant = null;
      const parts: UIMessage["parts"] = [];
      if (typeof content === "string") {
        parts.push({ type: "text", text: content });
      } else if (Array.isArray(content)) {
        for (const c of content) {
          const p = c as Record<string, unknown>;
          if (p.type === "text") {
            parts.push({ type: "text", text: p.text as string });
          }
        }
      }
      result.push({ id: genId(), role: "user", parts });
      continue;
    }

    // ── Assistant ModelMessage ────────────────────────────────────────
    if (role === "assistant") {
      const uiMsg: UIMessage = {
        id: genId(),
        role: "assistant",
        parts: [],
      };

      if (Array.isArray(content)) {
        for (const c of content) {
          const p = c as Record<string, unknown>;
          if (p.type === "text" && (p.text as string)?.length > 0) {
            uiMsg.parts.push({ type: "text", text: p.text as string });
          } else if (p.type === "tool-call") {
            // ModelMessage tool-call: { type: "tool-call", toolCallId, toolName, input }
            // Convert to UIMessage: { type: "tool-{toolName}", toolCallId, state, input }
            // State starts as "input-available" — will be upgraded to "output-available"
            // when the corresponding tool-result ModelMessage is processed.
            uiMsg.parts.push(
              makeToolPart({
                toolName: p.toolName as string,
                toolCallId: p.toolCallId as string,
                input: p.input ?? p.args ?? {},
                state: "input-available",
              }),
            );
          }
        }
      } else if (typeof content === "string" && content.length > 0) {
        uiMsg.parts.push({ type: "text", text: content });
      }

      currentAssistant = uiMsg;
      result.push(uiMsg);
      continue;
    }

    // ── Tool ModelMessage (results) ──────────────────────────────────
    if (role === "tool") {
      if (!currentAssistant || !Array.isArray(content)) continue;

      for (const c of content) {
        const p = c as Record<string, unknown>;
        if (p.type === "tool-result") {
          // ModelMessage tool-result: { type: "tool-result", toolCallId, toolName, output }
          // output is ToolResultOutput: { type: "json"|"text", value: ... }
          // Need to unwrap to raw value for UIMessage format.
          const toolPart = currentAssistant.parts.find(
            (part) => {
              const raw = part as Record<string, unknown>;
              return (
                typeof raw.type === "string" &&
                (raw.type as string).startsWith("tool-") &&
                raw.toolCallId === p.toolCallId
              );
            },
          ) as Record<string, unknown> | undefined;

          if (toolPart) {
            toolPart.state = "output-available";
            toolPart.output = unwrapToolOutput(p.output ?? p.result);
          }
        }
      }
      continue;
    }
  }

  return result;
}

// ─── Legacy ChatMessage rows (old /chat) ─────────────────────────────────────

/** A place as the old route stored it in ChatMessage.places. */
type LegacyPlace = {
  googlePlaceId: string;
  name: string;
  formattedAddress?: string;
  lat: number;
  lng: number;
  types?: string[] | null;
  primaryType?: string | null;
  priceLevel?: string | null;
  photoRef?: string | null;
  photoRefs?: string[] | null;
  emoji?: string | null;
  dbId?: string | null;
  neighborhood?: string | null;
  tags?: { slug: string; displayName: string }[] | null;
};

function isLegacyPlace(p: unknown): p is LegacyPlace {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return typeof o.googlePlaceId === "string" && typeof o.name === "string" &&
    typeof o.lat === "number" && typeof o.lng === "number";
}

function legacyPlaceToRow(p: LegacyPlace): PlaceRow {
  return {
    kind: "place",
    placeId: p.dbId ?? null,
    googlePlaceId: p.googlePlaceId,
    name: p.name,
    emoji: p.emoji ?? null,
    category: getChatCategory(p.primaryType ?? null, p.types ?? []) || undefined,
    neighborhood: p.neighborhood ?? null,
    lat: p.lat,
    lng: p.lng,
    priceLevel: p.priceLevel ?? null,
    photoRef: p.photoRef ?? p.photoRefs?.[0] ?? null,
    tags: (p.tags ?? []).slice(0, 3).map((t) => ({ slug: t.slug, displayName: t.displayName })),
    creators: [],
  };
}

export type LegacyChatMessage = {
  id: string;
  role: string;
  content: string;
  places: unknown;
};

/**
 * Old conversations: `content` → a text part; `places` → a synthesized
 * tool-search_places part (output-available, place-list envelope) placed
 * before the text, the order the new agent produces them in.
 */
export function legacyChatMessagesToUIMessages(rows: LegacyChatMessage[]): UIMessage[] {
  return rows.map((row) => {
    const parts: UIMessage["parts"] = [];
    const places = Array.isArray(row.places) ? row.places.filter(isLegacyPlace) : [];
    if (row.role === "assistant" && places.length > 0) {
      const placeRows = places.map(legacyPlaceToRow);
      parts.push(
        makeToolPart({
          toolName: "search_places",
          toolCallId: `legacy-${row.id}`,
          input: { query: "" },
          state: "output-available",
          output: {
            ok: true,
            ui: "place-list",
            summary: placeRows.map((p) => `${p.name}${p.neighborhood ? ` (${p.neighborhood})` : ""}`).join("; "),
            data: { query: "", scope: "legacy", places: placeRows, total: placeRows.length, truncated: false },
          },
        }),
      );
    }
    if (row.content) parts.push({ type: "text", text: row.content });
    return {
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      parts,
    };
  });
}
