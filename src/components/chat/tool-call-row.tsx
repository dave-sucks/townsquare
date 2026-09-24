"use client";

/**
 * ToolCallRow — generic row. Reads result.ui, dispatches to the correct
 * renderer (ported from Hindsight components/agent/ToolCallRow.tsx).
 *
 * Renderer surface is intentionally minimal:
 *   "tool-ui"      → ToolUIRenderer (the ONE generic renderer)
 *   "place-list"   → PlaceListRenderer (the loud one, synced with the map)
 *   "ask-question" → AskQuestionRenderer (Tool UI Question Flow)
 *
 * Do NOT add a new renderer for a list-shaped tool. Return `ui: "tool-ui"`
 * and `data.items: ToolUIItem[]` from the tool and let ToolUIRenderer handle it.
 */

import { useEffect, useRef } from "react";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { queryClient } from "@/lib/query-client";
import { normalizeToolResult, inferToolUI, type ToolResult } from "@/lib/agent/tool-result";
import { ToolUIRenderer } from "@/components/chat/renderers/tool-ui-renderer";
import { PlaceListRenderer } from "@/components/chat/renderers/place-list-renderer";
import { AskQuestionRenderer } from "@/components/chat/renderers/ask-question-renderer";
import { ToolErrorRow } from "@/components/chat/tool-error-row";
import { isEmptyPlaceList } from "@/components/chat/chain-of-thought";

interface Props {
  toolName: string;
  toolCallId?: string;
  args: Record<string, unknown>;
  rawResult: unknown;
  /** True while the tool is still executing (no result yet) */
  loading: boolean;
}

/** Tools that write the user's saves/lists; the app's save state refreshes when they finish. */
const WRITE_TOOLS = new Set(["save_place", "add_to_list"]);

/**
 * When a write tool finishes in this session (not on replay), refresh the
 * queries every save control reads, so they update without a reload.
 */
function useRefreshAfterWrite(toolName: string, done: boolean) {
  const sawRunning = useRef(!done);
  useEffect(() => {
    if (!done) {
      sawRunning.current = true;
      return;
    }
    if (!WRITE_TOOLS.has(toolName) || !sawRunning.current) return;
    sawRunning.current = false;
    for (const key of ["saved-places", "lists", "list", "collections", "place-detail", "user"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [toolName, done]);
}

export function ToolCallRow({ toolName, toolCallId, args, rawResult, loading }: Props) {
  useRefreshAfterWrite(toolName, rawResult != null);
  const result: ToolResult =
    rawResult != null
      ? normalizeToolResult(toolName, rawResult)
      : { ok: true, ui: inferToolUI(toolName), summary: "", data: null, sources: [] };

  if (!result.ok) {
    return <ToolErrorRow toolName={toolName} args={args} error={result.error} />;
  }

  switch (result.ui) {
    case "place-list":
      // An empty search renders as a quiet step inside the trace.
      if (!loading && isEmptyPlaceList(result.data)) {
        return (
          <ToolUIRenderer
            toolName={toolName}
            args={args}
            result={{ ...result, data: { items: [] }, summary: "" }}
            loading={false}
            secondary="nothing yet"
          />
        );
      }
      return (
        <PlaceListRenderer toolName={toolName} toolCallId={toolCallId} args={args} result={result} loading={loading} />
      );
    case "ask-question":
      return <AskQuestionRenderer toolName={toolName} result={result} loading={loading} />;
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
