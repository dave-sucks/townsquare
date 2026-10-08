/** How runs and steps read in the admin: cost, duration, stage names. */

export type RunRow = {
  id: string;
  kind: "post" | "place";
  status: string;
  trigger: string;
  costUsd: number;
  startedAt: string;
  durationMs: number | null;
  error: string | null;
  post: { id: string; shortcode: string; handle: string; caption: string | null; mediaUrl: string | null } | null;
  place: { id: string; name: string; googlePlaceId: string; photoRef: string | null } | null;
  stages: string[];
  stepsDone: number;
  stepsTotal: number;
};

export function formatCost(usd: number) {
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`;
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** Each step, named for what it does. */
export const STAGE_LABEL: Record<string, string> = {
  sync: "Check for new posts",
  media: "Save the photos",
  read: "Read the post",
  resolve: "Find the place",
  mentions: "Save to the map",
  tag: "Tag the place",
  aggregate: "Recount tags",
  summarize: "Write the summary",
};

/** Why a run happened. */
export const TRIGGER_LABEL: Record<string, string> = {
  ingest: "New post",
  reprocess: "Re-run",
  rerun: "Re-run from a step",
  backfill: "Re-process all",
  place_changed: "Place refresh",
};

/** How a run or a post stands. */
export const STATUS_LABEL: Record<string, string> = {
  completed: "Done",
  needs_review: "Needs you",
  failed: "Failed",
  running: "Running",
  queued: "Waiting",
  not_a_place: "Not a place",
  unread: "Not read yet",
};

/** "claude-sonnet-5" → "Sonnet 5", "claude-haiku-4-5" → "Haiku 4.5". */
export function shortModel(model: string | null | undefined) {
  if (!model) return null;
  const m = model.match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?/);
  if (!m) return model;
  return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}
