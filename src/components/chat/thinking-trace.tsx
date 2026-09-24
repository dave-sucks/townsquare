"use client";

/**
 * ThinkingTrace — the expandable agent trace from Beautiful UI's "Thinking"
 * primitive (beautifului.dev/r/thinking-state.json), driven by real state
 * instead of the demo's timer, on townsquare's shadcn tokens.
 *
 * Header: a glyph + a label that shimmers while `working`, then settles to
 * the done label. The trace auto-expands while working and settles closed;
 * the user can toggle it either way. Rows hang off a hairline rail.
 *
 * Variants used by the chat:
 *   - reasoning: prose (the model's thinking summary)
 *   - search:    query row + linked result rows (favicon, title, domain)
 */

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
      <button
        type="button"
        aria-expanded={expanded}
        disabled={!hasBody}
        onClick={() => setManual(!expanded)}
        className="-mx-1.5 flex w-fit max-w-full items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-100 hover:bg-muted disabled:hover:bg-transparent"
      >
        <span
          className={cn(
            "flex shrink-0 transition-colors duration-200",
            working ? "text-muted-foreground" : "text-muted-foreground/70",
          )}
        >
          {icon ?? <SparkleIcon />}
        </span>
        <span role="status" className="min-w-0 truncate">
          {working ? (
            <span className="shimmer-text text-[13px] font-medium">{activeLabel}</span>
          ) : (
            <span className="text-[13px] font-medium text-muted-foreground animate-in fade-in duration-300">
              {doneLabel}
            </span>
          )}
        </span>
        {hasBody && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground/70 transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

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
            <div className="relative mt-1 ml-[5px] pl-4">
              <span aria-hidden className="absolute top-0 bottom-1 left-[3px] w-px bg-border" />
              <div className="flex flex-col gap-1 py-1">
                {query && (
                  <div className="flex h-6 items-center gap-2 px-1.5">
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
                    <span className="truncate text-[12.5px] text-muted-foreground">{query}</span>
                  </div>
                )}
                {rows?.map((row, i) => {
                  const inner = (
                    <>
                      {row.leading}
                      <span className="min-w-0 truncate text-[12.5px] font-medium text-foreground">{row.primary}</span>
                      {row.secondary && (
                        <span className="shrink-0 text-[11.5px] text-muted-foreground/70">{row.secondary}</span>
                      )}
                    </>
                  );
                  const rowClass =
                    "flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300";
                  const style = { animationDelay: `${Math.min(i, 6) * 60}ms` };
                  return row.href ? (
                    <a
                      key={`${row.href}-${i}`}
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(rowClass, "transition-colors duration-150 hover:bg-muted")}
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
                  <span className="px-1.5 text-[12px] text-muted-foreground/70 tabular-nums">+{moreCount} more</span>
                )}
                {children && (
                  <div className="px-1.5 text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
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
