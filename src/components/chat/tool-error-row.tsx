"use client";

/**
 * ToolErrorRow — the `result.ok === false` branch of ToolCallRow.
 *
 * NOT another renderer: renderers are reached through the `ui`
 * discriminator, which only exists on a *successful* ToolResult. A failure
 * has no `ui` and no items, so the error path needs its own row. Generic
 * across every tool: a muted step with the tool's label and the error.
 */

import { TraceStep } from "@/components/chat/chain-of-thought";
import { toolLabel } from "@/lib/agent/tool-labels";

export function ToolErrorRow({
  toolName,
  args,
  error,
}: {
  toolName: string;
  args?: Record<string, unknown>;
  error: string;
}) {
  return (
    <TraceStep failed label={`Couldn't finish: ${toolLabel(toolName, args)}`}>
      {/* An unbreakable token in a thrown error must wrap, not push the panel sideways. */}
      <p className="px-1.5 text-[12px] break-all text-muted-foreground">{error}</p>
    </TraceStep>
  );
}
