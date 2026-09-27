/**
 * The engine's one way to call a model: structured output validated against
 * a zod schema, the agent version's system prompt as a cached prefix, and
 * exact usage converted to dollars. (The chat keeps the AI SDK; the engine
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

export type LlmCall<S extends z.ZodType> = {
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

export async function callStructured<S extends z.ZodType>(call: LlmCall<S>): Promise<LlmResult<z.infer<S>>> {
  if (!isEngineModel(call.model)) throw new Error(`Unpriced model ${call.model}: add it to pricing.ts`);
  const model = call.model;

  const started = Date.now();
  const response = await anthropic().messages.parse({
    model,
    max_tokens: call.maxTokens,
    system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
    messages: call.messages,
    output_config: {
      format: zodOutputFormat(call.schema),
      ...(call.effort ? { effort: call.effort } : {}),
    },
  });
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

  if (response.parsed_output == null) {
    throw new LlmOutputError(`No valid output (stop_reason: ${response.stop_reason})`, usage, response.stop_reason);
  }
  const rawText = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return { ...usage, output: response.parsed_output, rawText };
}
