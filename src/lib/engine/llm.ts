/**
 * The engine's one way to call a model: structured output (output_config
 * with zodOutputFormat) validated against a zod schema, the agent version's
 * system prompt as a cached prefix, and exact usage converted to dollars. (The chat keeps the AI SDK; the engine
 * uses the Anthropic SDK for exact usage and structured outputs.)
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { costUsd, isEngineModel, type EngineModel } from "./pricing";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type LlmCall<S extends z.ZodType, P extends z.ZodType = S> = {
  model: string;
  /** The agent version's prompt. Sent as the cached prefix. */
  system: string;
  /**
   * The conversation: normally one user message (the context digest); a gate
   * retry adds the model's previous answer and what was wrong with it.
   */
  messages: Anthropic.MessageParam[];
  schema: S;
  /** Omit for models that don't take effort (Haiku 4.5 rejects it). */
  effort?: Effort | null;
  maxTokens: number;
  /**
   * Parse the answer with this looser schema instead of `schema` (which is
   * still what the model is given). For big enums a model can step outside
   * of: the stage's gate drops the stray values instead of the call failing.
   */
  parseWith?: P;
};

export type LlmUsage = {
  model: EngineModel;
  /** All input tokens: uncached + cache writes + cache reads. */
  tokensIn: number;
  tokensOut: number;
  /** Input tokens served from the prompt cache. */
  tokensCached: number;
  costUsd: number;
  latencyMs: number;
};

export type LlmResult<T> = LlmUsage & {
  output: T;
  /** The raw JSON text, for replaying a gate retry. */
  rawText: string;
};

/** The call was billed but produced no valid output (refusal, truncation). */
export class LlmOutputError extends Error {
  constructor(
    message: string,
    readonly usage: LlmUsage,
    readonly stopReason: string | null,
  ) {
    super(message);
    this.name = "LlmOutputError";
  }
}

export async function callStructured<S extends z.ZodType, P extends z.ZodType = S>(
  call: LlmCall<S, P>,
): Promise<LlmResult<z.infer<P>>> {
  if (!isEngineModel(call.model)) throw new Error(`Unpriced model ${call.model}: add it to pricing.ts`);
  const model = call.model;

  const params = {
    model,
    max_tokens: call.maxTokens,
    system: [{ type: "text" as const, text: call.system, cache_control: { type: "ephemeral" as const } }],
    messages: call.messages,
    output_config: {
      format: zodOutputFormat(call.schema),
      ...(call.effort ? { effort: call.effort } : {}),
    },
  };
  const started = Date.now();
  // Validated here rather than by messages.parse, so a reply that fails the
  // schema still reports what it cost.
  const response = await anthropic().messages.create(params);
  const latencyMs = Date.now() - started;

  const u = response.usage;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const uncachedInput = u.input_tokens ?? 0;
  const usage: LlmUsage = {
    model,
    tokensIn: uncachedInput + cacheWrite + cacheRead,
    tokensOut: u.output_tokens,
    tokensCached: cacheRead,
    costUsd: costUsd(model, { uncachedInput, cacheWrite, cacheRead, output: u.output_tokens }),
    latencyMs,
  };

  const rawText = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  // The model always gets the strict schema; parseWith only loosens our side.
  let output: unknown = null;
  let problem = "";
  try {
    const parsed = (call.parseWith ?? call.schema).safeParse(JSON.parse(rawText));
    if (parsed.success) output = parsed.data;
    else problem = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  } catch (err) {
    problem = `not JSON (${err instanceof Error ? err.message : "parse error"})`;
  }
  if (output == null) {
    throw new LlmOutputError(
      `No valid output (stop_reason: ${response.stop_reason}): ${problem} · reply starts: ${rawText.slice(0, 300)}`,
      usage,
      response.stop_reason,
    );
  }
  return { ...usage, output: output as z.infer<P>, rawText };
}
