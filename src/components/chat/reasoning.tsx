"use client";

/**
 * Reasoning — the model's thinking summary.
 *
 * Inside a chain-of-thought trace (the usual case) it's a prose step: muted,
 * clamped to three lines, click to read the rest. On its own it's a
 * ThinkingTrace (Beautiful UI "Thinking", reasoning variant) that shimmers
 * "Thinking" while it streams and settles to "Thought for Ns".
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThinkingTrace } from "@/components/chat/thinking-trace";
import { useInTrace } from "@/components/chat/chain-of-thought";
import { cn } from "@/lib/utils";

interface ReasoningProps {
  children: ReactNode;
  /** True while the reasoning part is still streaming. */
  isStreaming?: boolean;
}

export function Reasoning({ children, isStreaming = false }: ReasoningProps) {
  const inTrace = useInTrace();
  if (inTrace) return <ReasoningStep isStreaming={isStreaming}>{children}</ReasoningStep>;
  return <StandaloneReasoning isStreaming={isStreaming}>{children}</StandaloneReasoning>;
}

function ReasoningStep({ children, isStreaming }: ReasoningProps) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-muted animate-in fade-in duration-300"
    >
      <span
        className={cn(
          "block text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground",
          !open && "line-clamp-3",
          isStreaming && "text-muted-foreground/80",
        )}
      >
        {children}
      </span>
    </button>
  );
}

function StandaloneReasoning({ children, isStreaming = false }: ReasoningProps) {
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
