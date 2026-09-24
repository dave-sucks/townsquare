/**
 * POST /api/chat — the Townsquare agent chat.
 *
 * Adapted from Hindsight app/api/agent/[mode]/route.ts: one mode, Claude via
 * @ai-sdk/anthropic, our tools + Anthropic's server-side web search, streamed
 * as a UI message stream. The full UIMessage[] is saved to
 * Conversation.uiMessages when the stream finishes.
 *
 * Body: { messages: UIMessage[], conversationId, location?, mapBounds?, timezone? }
 * The client mints conversationId; the first message creates the row.
 */

import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  hasToolCall,
  createIdGenerator,
  type UIMessage,
  type ToolSet,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { waitUntil } from "@vercel/functions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHAT_MODEL, CHAT_MAX_STEPS, TITLE_MAX_CHARS, WEB_SEARCH_MAX_USES } from "@/lib/agent/config";
import { buildSystemMessages, loadChatUserContext } from "@/lib/agent/system-prompt";
import { citationMarkers } from "@/lib/agent/citations";

export const maxDuration = 300;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips tool result payloads down to their summary string before the
 * messages are converted and sent to the model. The full data object
 * stays on the client for UI rendering — the model only needs the
 * one-line summary to continue reasoning. Prevents accumulated tool
 * results from blowing up the input token count over a long conversation.
 *
 * Matches AI SDK v6 UIMessage tool parts (`type: "tool-<name>"`, `output`).
 * Hindsight's copy matched `type === "tool-result"`, which is the
 * ModelMessage shape, so on UIMessages it never trimmed anything.
 * Provider-executed tools (web_search) are left alone: their output is the
 * result list the API expects back verbatim.
 */
function trimToolResults(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    if (!Array.isArray(msg.parts)) return msg;
    const parts = msg.parts.map((part) => {
      const p = part as Record<string, unknown>;
      if (typeof p.type !== "string" || !p.type.startsWith("tool-")) return part;
      if (p.providerExecuted || p.state !== "output-available") return part;
      const output = p.output as Record<string, unknown> | undefined;
      if (!output || typeof output.summary !== "string") return part;
      return { ...p, output: { ok: output.ok, summary: output.summary } } as unknown as typeof part;
    });
    return { ...msg, parts };
  });
}

/**
 * Leave Anthropic-executed tool calls (web_search, and the code_execution
 * steps web_search_20260209 runs to filter results) out of the history sent
 * back to the model.
 *
 * 1. They can't be replayed faithfully. A dynamically filtered search is
 *    called *from* a code_execution block and carries a `caller` pointing at
 *    it, but those code_execution calls never reach the UI stream (they
 *    aren't in our tool set), so the saved thread has the search without its
 *    caller and the API rejects the next turn: "source tool srvtoolu_… not
 *    found for tool use block srvtoolu_…". Seen live 2026-09-23 on the first
 *    follow-up in a conversation that had searched.
 * 2. They're big: a search result list is thousands of tokens of encrypted
 *    page content, re-sent on every later turn. The answer the model wrote
 *    from them stays in the history; it can search again if it needs to.
 *
 * A turn that loses blocks also loses its thinking. Thinking blocks are
 * signed against the content before them, so once the search blocks are gone
 * the API rejects them: "thinking or redacted_thinking blocks in the latest
 * assistant message cannot be modified". Thinking from a finished turn may be
 * omitted, so it is.
 *
 * A trailing assistant message is a turn still in progress (the client just
 * supplied a tool result, e.g. an ask_question answer). Its blocks must go
 * back exactly as they were, so it is left alone.
 *
 * The UI keeps all of it — this only shapes what goes to the model.
 */
function dropServerToolCalls(messages: UIMessage[]): UIMessage[] {
  const last = messages.length - 1;
  return messages.map((msg, i) => {
    if (msg.role !== "assistant" || i === last) return msg;
    const isServerTool = (part: UIMessage["parts"][number]) => {
      const p = part as Record<string, unknown>;
      return typeof p.type === "string" && p.type.startsWith("tool-") && p.providerExecuted === true;
    };
    if (!msg.parts.some(isServerTool)) return msg;
    return { ...msg, parts: msg.parts.filter((p) => !isServerTool(p) && p.type !== "reasoning") };
  });
}

/**
 * A turn that errored before producing anything leaves an assistant message
 * with no content (just step-start); the API rejects empty assistant turns.
 */
function dropEmptyAssistantMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(
    (msg) =>
      msg.role !== "assistant" ||
      msg.parts.some((p) => p.type === "text" ? p.text.trim().length > 0 : p.type !== "step-start"),
  );
}

function firstUserText(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() ?? "";
  if (!text) return "New Chat";
  return text.length > TITLE_MAX_CHARS ? `${text.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…` : text;
}

type LatLng = { lat: number; lng: number };
type Bounds = { north: number; south: number; east: number; west: number };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseLocation(v: unknown): LatLng | undefined {
  const o = v as Partial<LatLng> | null;
  return o && isNum(o.lat) && isNum(o.lng) ? { lat: o.lat, lng: o.lng } : undefined;
}

function parseBounds(v: unknown): Bounds | undefined {
  const o = v as Partial<Bounds> | null;
  return o && isNum(o.north) && isNum(o.south) && isNum(o.east) && isNum(o.west)
    ? { north: o.north, south: o.south, east: o.east, west: o.west }
    : undefined;
}

const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 });

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const t0 = Date.now();

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const messages = body.messages as UIMessage[] | undefined;
  const conversationId = body.conversationId;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages required", { status: 400 });
  }
  if (typeof conversationId !== "string" || conversationId.length === 0 || conversationId.length > 36) {
    return new Response("conversationId required", { status: 400 });
  }
  // Wired into the tool context in phase 2+; parsed now so bad input fails early.
  const location = parseLocation(body.location);
  const mapBounds = parseBounds(body.mapBounds);
  const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : undefined;
  console.log(
    `[chat] ▶ conversation=${conversationId} messages=${messages.length} location=${location ? "yes" : "no"} bounds=${mapBounds ? "yes" : "no"}`,
  );

  // ── Conversation: must be the user's; the first message creates it ─────
  const existing = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
  if (existing && existing.userId !== user.id) {
    return new Response("Conversation not found", { status: 404 });
  }
  if (!existing) {
    await prisma.conversation.create({
      data: { id: conversationId, userId: user.id, title: firstUserText(messages) },
    });
  }

  // ── Tools ──────────────────────────────────────────────────────────────
  const tools = {
    web_search: anthropic.tools.webSearch_20260209({
      maxUses: WEB_SEARCH_MAX_USES,
      ...(timezone ? { userLocation: { type: "approximate" as const, timezone } } : {}),
    }),
  } satisfies ToolSet;

  const userContext = await loadChatUserContext(user.id);
  const system = buildSystemMessages({ toolNames: Object.keys(tools), user: userContext });

  // ── Stream ─────────────────────────────────────────────────────────────

  // Explicit promise so waitUntil keeps the function alive until onFinish
  // completes all its async DB work (message persistence).
  // result.response alone may resolve before the async onFinish body finishes.
  let resolveOnFinish: () => void;
  const onFinishPromise = new Promise<void>((resolve) => {
    resolveOnFinish = resolve;
  });

  // Strip tool results down to summary-only before sending to the model.
  // Full data stays on the client for UI rendering — the model only needs
  // the one-line summary to continue reasoning.
  const modelMessages = await convertToModelMessages(
    dropEmptyAssistantMessages(dropServerToolCalls(trimToolResults(messages))),
    {
      tools,
      // A turn stopped mid-tool-call leaves a call with no result; the API
      // rejects that on the next turn.
      ignoreIncompleteToolCalls: true,
    },
  );

  const result = streamText({
    model: anthropic(CHAT_MODEL),
    system,
    messages: modelMessages,
    tools,
    providerOptions: {
      anthropic: {
        // Current models reject a thinking budget; adaptive decides how much
        // to think. "summarized" gives the Reasoning block text to show
        // (the default on current models is omitted → empty thinking).
        thinking: { type: "adaptive", display: "summarized" },
        // Server-side refusal fallback, routed by refusal category.
        fallbacks: "default",
        // Automatic prompt caching: the tool loop re-sends the whole
        // conversation every step, so cache the growing prefix.
        cacheControl: { type: "ephemeral" },
      },
    },
    // Stop the turn when:
    //   • we hit the step ceiling, OR
    //   • the agent calls ask_question (the user must answer before the
    //     agent does anything else — without this stop the model keeps
    //     narrating after the question, which lands as orphaned prose under
    //     the question card and breaks the chat if the user clicks an option
    //     mid-stream). ask_question lands in phase 4.
    // ai SDK v6 accepts an array of StopConditions; first to fire wins.
    stopWhen: [stepCountIs(CHAT_MAX_STEPS), hasToolCall("ask_question")],
    experimental_transform: citationMarkers(),
    abortSignal: req.signal,

    onStepFinish({ toolCalls, finishReason, usage }) {
      const toolNames = toolCalls.map((tc) => tc.toolName).join(", ") || "none";
      console.log(
        `[chat] STEP elapsed=${Date.now() - t0}ms tools=[${toolNames}] finish=${finishReason} tokens=${usage?.totalTokens ?? "?"}`,
      );
    },
    onError({ error }) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[chat] ❌ STREAM ERROR elapsed=${Date.now() - t0}ms: ${msg}`);
    },
  });

  // Keep the model stream draining if the client disconnects, so the UI
  // stream's onFinish still fires and the turn is persisted.
  result.consumeStream();

  // Wait for BOTH the response stream AND the onFinish async work (message
  // persistence). result.response alone may resolve before onFinish completes
  // its DB writes, causing Vercel to kill the function and lose messages.
  waitUntil(
    Promise.all([Promise.resolve(result.response).catch(() => undefined), onFinishPromise]).then(
      () => undefined,
    ),
  );

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId,
    sendReasoning: true,
    sendSources: true,
    onError(error) {
      console.error("[chat] ❌", error);
      return "Something went wrong on our end. Try that again in a moment.";
    },
    async onFinish({ messages: all, isAborted }) {
      try {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { uiMessages: all as unknown as object, updatedAt: new Date() },
        });
        console.log(
          `[chat] ✅ persisted ${all.length} messages elapsed=${Date.now() - t0}ms${isAborted ? " (aborted)" : ""}`,
        );
      } catch (err) {
        console.error("[chat] Failed to persist messages:", err);
      } finally {
        resolveOnFinish!();
      }
    },
  });
}
