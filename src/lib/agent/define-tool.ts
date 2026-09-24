/**
 * defineTool() — factory for the chat's tool pipeline.
 *
 * Ported from Hindsight lib/agent/define-tool.ts (minus its gate telemetry
 * and per-mode filtering). Wraps every tool execute function with:
 *   - Timing + structured logging
 *   - try/catch → ToolResult.ok:false on errors
 *   - Consistent ToolResult envelope (ok, ui, groupId, progressLabel,
 *     summary, data, sources)
 *
 * Usage:
 *   export const findCreators = defineTool({
 *     description: "…",
 *     schema: z.object({ query: z.string() }),
 *     ui: "tool-ui",
 *     progressLabel: ({ query }) => `Finding creators who post about ${query}`,
 *     execute: async ({ query }, ctx) => ({ summary, data: { items } }),
 *   });
 *
 *   // In the route:
 *   const tools = { find_creators: findCreators(ctx) };
 */

import { tool } from "ai";
import type { z } from "zod";
import type { ToolContext } from "./tool-context";
import type { ToolUI, ToolSource, ToolResult } from "./tool-result";

interface DefineToolOptions<TSchema extends z.ZodTypeAny> {
  description: string;
  /** Zod schema for input args */
  schema: TSchema;
  /** Which UI renderer handles this tool's result */
  ui: ToolUI;
  /** Optional phase key — tools with the same groupId collapse in the UI */
  groupId?: string;
  /**
   * Produces a human-readable, present-tense gerund label from the args —
   * shown in the tool row and used to derive the group header. A good
   * label reads like a Chain-of-Thought line:
   *   "Finding burger spots your people posted near you"
   *   "Reading @girlgottaeatz's recent posts"
   *   "Checking your want-to-go list"
   * If omitted, the UI falls back to the tool name.
   */
  progressLabel?: (args: z.infer<TSchema>) => string;
  execute: (
    args: z.infer<TSchema>,
    ctx: ToolContext,
  ) => Promise<{
    summary: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    sources?: ToolSource[];
    /**
     * Optional per-call UI override. Defaults to options.ui set on the
     * factory. Use when a single tool returns differently-shaped results —
     * e.g. places_from_people_i_follow returns a generic row (not an empty
     * place list) when the user follows nobody.
     */
    ui?: ToolUI;
    /** Optional per-call label override (e.g. once the tool knows a name). */
    progressLabel?: string;
  }>;
}

/** A defineTool call returns a "tool factory" — call it with ctx to get an AI SDK tool. */
export type ToolFactory<TSchema extends z.ZodTypeAny> = (
  ctx: ToolContext,
) => ReturnType<typeof tool<TSchema, ToolResult>>;

export function defineTool<TSchema extends z.ZodTypeAny>(
  options: DefineToolOptions<TSchema>,
): ToolFactory<TSchema> {
  return function makeToolInstance(ctx: ToolContext) {
    // AI SDK v6 `tool()` narrows the schema generic through Zod v4's
    // `$ZodType` internals, which TS can't unify with our generic
    // `z.ZodTypeAny` parameter at the factory boundary. Runtime behavior
    // is fine; cast is scoped to the tool() call-site only.
    return tool<TSchema, ToolResult>({
      description: options.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: options.schema as any,
      execute: async (args): Promise<ToolResult> => {
        const t0 = Date.now();
        const resolvedGroupId = options.groupId ? ctx.groupId(options.groupId) : undefined;
        const label = options.description.slice(0, 40);

        console.log(`[tool] START "${label}" conversation=${ctx.conversationId}`);

        // Compute the human progress label from args once. Wrapped in
        // try/catch so a malformed label builder can never break the tool.
        let progressLabel: string | undefined;
        if (options.progressLabel) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            progressLabel = options.progressLabel(args as any);
          } catch {
            progressLabel = undefined;
          }
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await options.execute(args as any, ctx);
          console.log(`[tool] END "${label}" ${Date.now() - t0}ms`);
          const finalLabel = result.progressLabel ?? progressLabel;
          return {
            ok: true as const,
            ui: result.ui ?? options.ui,
            ...(resolvedGroupId !== undefined ? { groupId: resolvedGroupId } : {}),
            ...(finalLabel !== undefined ? { progressLabel: finalLabel } : {}),
            summary: result.summary,
            data: result.data,
            sources: result.sources ?? [],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Tool failed";
          console.error(`[tool] FAILED "${label}" ${Date.now() - t0}ms:`, msg);
          return {
            ok: false as const,
            error: msg,
            retryable: false,
            sources: [],
          };
        }
      },
    });
  };
}
