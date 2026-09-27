"use client";

/**
 * What a source's card and its creator's sync strip show: the import page's
 * metrics line (posts, places, then amber needs-review and red failed counts)
 * and when it last synced.
 */

import { formatDistanceToNowStrict } from "date-fns";

export type SourceSummary = {
  id: string;
  handle: string;
  status: "active" | "paused";
  homeCity: string | null;
  notes: string | null;
  trustWeight: number;
  lastSyncedAt: string | null;
  lastPostAt: string | null;
  user: { id: string; username: string | null; avatar: string | null; name: string | null } | null;
  lastSync: { id: string; status: string; createdAt: string; fetched: number; error: string | null } | null;
  posts: number;
  places: number;
  needsReview: number;
  notAPlace: number;
  failed: number;
};

/** The dot's status: paused, the last sync's state, or never synced. */
export function sourceStatus(source: SourceSummary): string {
  if (source.status === "paused") return "paused";
  return source.lastSync?.status ?? "new";
}

export function lastSyncLabel(source: SourceSummary): string {
  if (source.lastSync?.status === "running" || source.lastSync?.status === "queued" || source.lastSync?.status === "pending") return "Syncing now";
  const at = source.lastSyncedAt ?? source.lastSync?.createdAt;
  if (!at) return "Never synced";
  return `Synced ${formatDistanceToNowStrict(new Date(at), { addSuffix: true })}`;
}

export function SourceMetrics({ source, className }: { source: SourceSummary; className?: string }) {
  return (
    <div className={className ?? "flex items-center gap-3 text-xs text-muted-foreground flex-wrap"} data-testid={`metrics-source-${source.handle}`}>
      <span>{source.posts} posts</span>
      <span>{source.places} places</span>
      {source.needsReview > 0 && <span className="text-amber-600">{source.needsReview} need review</span>}
      {source.notAPlace > 0 && <span>{source.notAPlace} not a place</span>}
      {source.failed > 0 && <span className="text-red-600">{source.failed} failed</span>}
    </div>
  );
}
