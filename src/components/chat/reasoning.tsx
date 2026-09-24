"use client";

/**
 * Reasoning — the model's thinking summary as a ThinkingTrace (Beautiful UI
 * "Thinking", reasoning variant).
 *
 * The label shimmers "Thinking" while the reasoning tokens stream, then
 * settles to "Thought for Ns" (measured live) or "Reasoning" for a replayed
 * conversation, where the duration isn't known. Open while streaming,
 * collapsed once done.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThinkingTrace } from "@/components/chat/thinking-trace";

interface ReasoningProps {
  children: ReactNode;
  /** True while the reasoning part is still streaming. */
  isStreaming?: boolean;
}

export function Reasoning({ children, isStreaming = false }: ReasoningProps) {
  const startedAt = useRef<number | null>(isStreaming ? Date.now() : null);
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (isStreaming && startedAt.current == null) startedAt.current = Date.now();
    if (!isStreaming && startedAt.current != null && seconds == null) {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    }
  }, [isStreaming, seconds]);

  return (
    <ThinkingTrace
      working={isStreaming}
      activeLabel="Thinking"
      doneLabel={seconds != null ? `Thought for ${seconds}s` : "Reasoning"}
    >
      {children}
    </ThinkingTrace>
  );
}
