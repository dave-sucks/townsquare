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

export const STAGE_LABEL: Record<string, string> = {
  sync: "Sync",
  media: "Media",
  read: "Read",
  resolve: "Resolve",
  mentions: "Mentions",
  tag: "Tag",
  aggregate: "Aggregate",
  summarize: "Summarize",
};

/** "claude-sonnet-5" → "Sonnet 5", "claude-haiku-4-5" → "Haiku 4.5". */
export function shortModel(model: string | null | undefined) {
  if (!model) return null;
  const m = model.match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?/);
  if (!m) return model;
  return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}
