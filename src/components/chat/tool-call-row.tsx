"use client";

/**
 * ToolCallRow — generic row. Reads result.ui, dispatches to the correct
 * renderer (ported from Hindsight components/agent/ToolCallRow.tsx).
 *
 * Renderer surface is intentionally minimal:
 *   "tool-ui"      → ToolUIRenderer (the ONE generic renderer)
 *   "place-list"   → PlaceListRenderer (phase 3; ToolUIRenderer until then)
 *   "ask-question" → AskQuestionRenderer (phase 4; ToolUIRenderer until then)
 *
 * Do NOT add a new renderer for a list-shaped tool. Return `ui: "tool-ui"`
 * and `data.items: ToolUIItem[]` from the tool and let ToolUIRenderer handle it.
 */

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { normalizeToolResult, inferToolUI, type ToolResult } from "@/lib/agent/tool-result";
import { ToolUIRenderer } from "@/components/chat/renderers/tool-ui-renderer";
import { ToolErrorRow } from "@/components/chat/tool-error-row";

interface Props {
  toolName: string;
  toolCallId?: string;
  args: Record<string, unknown>;
  rawResult: unknown;
  /** True while the tool is still executing (no result yet) */
  loading: boolean;
}

export function ToolCallRow({ toolName, args, rawResult, loading }: Props) {
  const result: ToolResult =
    rawResult != null
      ? normalizeToolResult(toolName, rawResult)
      : { ok: true, ui: inferToolUI(toolName), summary: "", data: null, sources: [] };

  if (!result.ok) {
    return <ToolErrorRow toolName={toolName} args={args} error={result.error} />;
  }

  switch (result.ui) {
    case "place-list":
    case "ask-question":
    case "tool-ui":
    default:
      return <ToolUIRenderer toolName={toolName} args={args} result={result} loading={loading} />;
  }
}

/** assistant-ui tool part → ToolCallRow. The `tools.Fallback` for every defineTool tool. */
export const ToolPart: ToolCallMessagePartComponent = ({ toolName, toolCallId, args, result, status }) => {
  const loading = result === undefined && status?.type === "running";
  return (
    <ToolCallRow
      toolName={toolName}
      toolCallId={toolCallId}
      args={(args ?? {}) as Record<string, unknown>}
      rawResult={result}
      loading={loading || (result === undefined && status?.type !== "incomplete")}
    />
  );
};
