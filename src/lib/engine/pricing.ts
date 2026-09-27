/**
 * What a model call cost, from its token usage. Prices are $ per million
 * tokens (platform.claude.com pricing). Cache reads bill at 10% of the input
 * price and 5-minute cache writes at 125%.
 */

export const MODEL_PRICES = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-5": { input: 5, output: 25 },
} as const;

export type EngineModel = keyof typeof MODEL_PRICES;

export const ENGINE_MODELS = Object.keys(MODEL_PRICES) as EngineModel[];

export function isEngineModel(model: string): model is EngineModel {
  return model in MODEL_PRICES;
}

export type TokenUsage = {
  /** Input tokens billed at the full rate (not read from or written to cache). */
  uncachedInput: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
};

const CACHE_READ_RATE = 0.1;
const CACHE_WRITE_RATE = 1.25;

export function costUsd(model: EngineModel, usage: TokenUsage): number {
  const price = MODEL_PRICES[model];
  const dollars =
    (usage.uncachedInput * price.input +
      usage.cacheWrite * price.input * CACHE_WRITE_RATE +
      usage.cacheRead * price.input * CACHE_READ_RATE +
      usage.output * price.output) /
    1_000_000;
  // Store to a hundredth of a cent's precision.
  return Math.round(dollars * 1_000_000) / 1_000_000;
}
