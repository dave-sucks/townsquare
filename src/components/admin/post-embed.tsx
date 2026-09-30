"use client";

/**
 * A post as the Feed shows it (Instagram's own embed), under a label tab in
 * the Feed's "Visited …" style that says what the post is waiting for, with
 * room for small actions on the right of the tab.
 */

import * as React from "react";
import { SocialPostCard } from "@/components/shared/social-post-card";
import { StatusDot } from "@/components/shared/status-dot";
import { cn } from "@/lib/utils";

/** The Instagram embed's border color, which the Feed's tab matches. */
const IG_BORDER = "#dbdbdb";

export function PostLabelTab({ label, status, actions }: { label: React.ReactNode; status?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-end pl-4" data-testid="post-label-tab">
      <div className="h-[10px] w-[10px] shrink-0" style={{ background: `radial-gradient(circle at 0% 0, transparent 10px, ${IG_BORDER} 10px)` }} />
      <span
        className="flex max-w-[75%] items-center gap-1.5 truncate px-3 py-1 text-xs font-medium"
        style={{ background: IG_BORDER, borderRadius: "8px 8px 0 0", color: "#262626" }}
      >
        {status && <StatusDot status={status} />}
        <span className="truncate">{label}</span>
      </span>
      <div className="h-[10px] w-[10px] shrink-0" style={{ background: `radial-gradient(circle at 100% 0, transparent 10px, ${IG_BORDER} 10px)` }} />
      <div className="flex-1" />
      {actions && <div className="mb-0.5 flex items-center gap-0.5">{actions}</div>}
    </div>
  );
}

export function PostEmbed({
  permalink,
  author = "",
  label,
  status,
  actions,
  className,
}: {
  permalink: string | null;
  /** The creator's handle. */
  author?: string;
  label: React.ReactNode;
  /** A StatusDot status: needs_review, failed, completed… */
  status?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("bg-card", className)}>
      <PostLabelTab label={label} status={status} actions={actions} />
      {permalink ? (
        <SocialPostCard author={author} permalink={permalink} />
      ) : (
        <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">This post has no Instagram link.</p>
      )}
    </article>
  );
}
