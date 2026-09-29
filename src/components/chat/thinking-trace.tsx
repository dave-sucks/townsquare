"use client";

/**
 * ThinkingTrace — the expandable agent trace from Beautiful UI's "Thinking"
 * primitive (beautifului.dev/r/thinking-state.json), driven by real state
 * instead of the demo's timer, on townsquare's shadcn tokens.
 *
 * Header: plain text + chevron (TextToggle) that shimmers while `working`,
 * then settles to the done label. The trace auto-expands while working and
 * settles closed; the user can toggle it either way. Rows hang off a
 * hairline rail.
 *
 * Variants used by the chat:
 *   - reasoning: prose (the model's thinking summary)
 *   - search:    query row + linked result rows (favicon, title, domain)
 */

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TextToggle } from "@/components/chat/text-toggle";

export type TraceRow = {
  primary: string;
  secondary?: string;
  href?: string;
  /** Small leading visual (favicon, emoji). */
  leading?: ReactNode;
};

export function ThinkingTrace({
  working,
  activeLabel,
  doneLabel,
  icon,
  query,
  rows,
  moreCount = 0,
  children,
  defaultExpanded,
}: {
  working: boolean;
  activeLabel: string;
  doneLabel: string;
  icon?: ReactNode;
  query?: string;
  rows?: TraceRow[];
  moreCount?: number;
  /** Prose body (reasoning variant). */
  children?: ReactNode;
  /** Expanded state before the user toggles; defaults to "open while working". */
  defaultExpanded?: boolean;
}) {
  const [manual, setManual] = useState<boolean | null>(null);
  const expanded = manual ?? defaultExpanded ?? working;
  const hasBody = Boolean(query || rows?.length || children);

  return (
    <div className="my-1 flex w-full flex-col">
      <TextToggle
        label={working ? activeLabel : doneLabel}
        working={working}
        open={expanded}
        onClick={() => setManual(!expanded)}
        collapsible={hasBody}
      />

      {hasBody && (
        <div
          className="grid transition-[grid-template-rows,opacity] duration-400"
          style={{
            gridTemplateRows: expanded ? "1fr" : "0fr",
            opacity: expanded ? 1 : 0,
            transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <div className="overflow-hidden">
            <div className="mt-1 border-l pl-3">
              <div className="flex flex-col gap-1 py-0.5">
                {query && (
                  <div className="flex h-6 items-center gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="shrink-0 text-muted-foreground/70"
                      aria-hidden
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.3-4.3" />
                    </svg>
                    <span className="truncate text-[13px] text-muted-foreground">{query}</span>
                  </div>
                )}
                {rows?.map((row, i) => {
                  const inner = (
                    <>
                      {row.leading}
                      <span className="min-w-0 truncate text-[13px] text-muted-foreground">{row.primary}</span>
                      {row.secondary && (
                        <span className="shrink-0 text-[11.5px] text-muted-foreground/70">{row.secondary}</span>
                      )}
                    </>
                  );
                  const rowClass =
                    "flex min-h-6 w-full items-center gap-2 text-left animate-in fade-in fill-mode-both duration-300";
                  const style = { animationDelay: `${Math.min(i, 6) * 60}ms` };
                  return row.href ? (
                    <a
                      key={`${row.href}-${i}`}
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(rowClass, "transition-colors duration-150 hover:[&_span]:text-foreground")}
                      style={style}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={`${row.primary}-${i}`} className={rowClass} style={style}>
                      {inner}
                    </div>
                  );
                })}
                {moreCount > 0 && (
                  <span className="text-[12px] text-muted-foreground/70 tabular-nums">+{moreCount} more</span>
                )}
                {children && (
                  <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {children}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
