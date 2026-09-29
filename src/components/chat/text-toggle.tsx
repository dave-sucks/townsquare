"use client";

/**
 * The one collapsible header in the chat trace: plain muted text and a small
 * chevron, no padding or background, the way Claude, Grok and Perplexity show
 * their work (and Hindsight's ToolProgressHeader). The label shimmers while
 * the step is working. Used by the trace, its steps and the thinking trace.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TextToggle({
  label,
  working = false,
  open = false,
  onClick,
  collapsible = true,
  className,
}: {
  label: ReactNode;
  working?: boolean;
  open?: boolean;
  onClick?: () => void;
  /** False when there's nothing to expand: the label shows without a chevron. */
  collapsible?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={!collapsible}
      aria-expanded={collapsible ? open : undefined}
      onClick={onClick}
      className={cn(
        "group/toggle inline-flex max-w-full items-center gap-1 py-0.5 text-left text-[13px] text-muted-foreground transition-colors duration-150 enabled:hover:text-foreground",
        className,
      )}
    >
      <span role="status" className={cn("min-w-0 truncate", working && "shimmer-text")}>
        {label}
      </span>
      {collapsible && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-70 transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0)" }}
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </button>
  );
}
