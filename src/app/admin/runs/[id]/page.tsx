"use client";

/**
 * One run's trace: the post (or place) on top, then every stage as the
 * chat's TraceStep rows (label, model, cost, time), each expanding to its
 * input and output JSON with "Re-run from here".
 */

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { AdminShell } from "@/components/admin/admin-shell";
import { PostEmbed } from "@/components/admin/post-embed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TraceStep } from "@/components/chat/chain-of-thought";
import { StatusDot } from "@/components/shared/status-dot";
import { adminFetch } from "@/components/admin/admin-fetch";
import { MentionEditor } from "@/components/admin/mention-editor";
import { STAGE_LABEL, formatCost, formatDuration, shortModel } from "@/components/admin/run-format";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  stage: string;
  key: string;
  status: "running" | "completed" | "failed" | "skipped";
  input: unknown;
  output: unknown;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  costUsd: number;
  latencyMs: number | null;
  error: string | null;
  attempt: number;
  agentVersion: { agentKey: string; version: number } | null;
};

type Run = {
  id: string;
  kind: "post" | "place";
  status: string;
  trigger: string;
  fromStage: string | null;
  costUsd: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps: Step[];
  post: { id: string; canonicalPostId: string; url: string | null; caption: string | null; postedAt: string | null; authorHandle: string; media: unknown; postType: string | null } | null;
  place: { id: string; name: string; googlePlaceId: string; formattedAddress: string } | null;
};

const RERUNNABLE = new Set(["read", "resolve", "tag", "aggregate", "summarize"]);

/** Why the run happened, in words. */
const TRIGGER_LABEL: Record<string, string> = {
  ingest: "new post",
  reprocess: "re-run",
  rerun: "re-run from a step",
  backfill: "re-process all",
  place_changed: "place refresh",
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** A step's name, with the place it was about when there is one. */
function stepLabel(step: Step, names: Map<string, string>) {
  const stage = STAGE_LABEL[step.stage] ?? step.stage;
  if (step.stage === "resolve") {
    const name = (obj(obj(step.input).place).name as string | undefined) ?? (obj(step.output).placeName as string | undefined);
    return name ? `${stage} “${name}”` : stage;
  }
  if (step.stage === "tag") {
    const name = names.get(step.key);
    return name ? `${stage} “${name}”` : stage;
  }
  return stage;
}

/** One line on what the step decided. */
function stepOutcome(step: Step): string | null {
  const out = obj(step.output);
  if (step.status === "skipped" || out.skipped) return (out.reason as string | undefined) ?? "skipped";
  switch (step.stage) {
    case "read": {
      const places = Array.isArray(out.places) ? out.places.length : 0;
      return out.postType === "not_a_place" ? "not a place" : `${places} ${places === 1 ? "place" : "places"}`;
    }
    case "resolve":
      return out.outcome === "accepted" ? `matched by ${out.resolvedBy ?? "code"}` : out.outcome === "review" ? "sent to review" : null;
    case "mentions":
      return Array.isArray(out.mentions) ? `${out.mentions.length} saved` : null;
    case "tag":
      return Array.isArray(out.kept) ? `${out.kept.length} ${out.kept.length === 1 ? "tag" : "tags"}` : null;
    default:
      return null;
  }
}

const humanize = (slug: string) => slug.replace(/_/g, " ");

/** What a step did, in plain words. */
function stepSummary(step: Step, names: Map<string, string>): string | null {
  const out = obj(step.output);
  if (step.status === "failed") return step.error ? `Failed: ${step.error}` : "Failed";
  if (step.status === "skipped" || out.skipped) return `Skipped: ${String(out.reason ?? "nothing changed")}`;
  switch (step.stage) {
    case "read": {
      if (out.postType === "not_a_place") return `Decided the post isn't about a place${out.notPlaceReason ? `: ${String(out.notPlaceReason)}` : ""}.`;
      const places = arr(out.places).map((p) => String(obj(p).name));
      return places.length ? `Found ${places.length === 1 ? "1 place" : `${places.length} places`}: ${places.join(", ")}.` : "Found no places.";
    }
    case "resolve":
      return out.outcome === "accepted"
        ? `Matched it to ${String(out.placeName ?? "a place")}${out.resolvedBy === "agent" ? " (the agent picked)" : ""}.`
        : `Wasn't sure which place this is, so it asked a person${arr(out.candidates).length ? ` (${arr(out.candidates).length} candidates)` : ""}.`;
    case "mentions": {
      const saved = arr(out.mentions).length;
      const removed = Number(out.removed ?? 0);
      return `Saved ${saved === 1 ? "1 place" : `${saved} places`} on the post${removed ? `, removed ${removed}` : ""}.`;
    }
    case "tag": {
      const kept = arr(out.kept).map((t) => humanize(String(obj(t).slug)));
      return kept.length ? `Tagged ${names.get(step.key) ?? "the place"}: ${kept.join(", ")}.` : "Added no tags.";
    }
    case "aggregate":
      return "Recounted the place's tags and dishes from every post.";
    case "summarize":
      return out.summary ? `Wrote the summary: “${String(out.summary)}”` : null;
    default:
      return null;
  }
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col gap-1 py-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [editing, setEditing] = React.useState(false);
  const { data, isLoading, error } = useQuery<{ run: Run }>({
    queryKey: ["admin-run", id],
    queryFn: () => adminFetch(`/api/admin/runs/${id}`),
    refetchInterval: (q) => (q.state.data?.run.status === "running" || q.state.data?.run.status === "queued" ? 3000 : false),
  });
  const run = data?.run;

  const rerun = useMutation({
    mutationFn: (fromStage: string) => adminFetch<{ queued: boolean }>(`/api/admin/runs/${id}`, { method: "POST", json: { fromStage } }),
    onSuccess: (r, fromStage) => {
      toast.success(r.queued ? `Re-running from ${STAGE_LABEL[fromStage] ?? fromStage}. The new run is at the top of Runs.` : "The runner isn't reachable; try again");
      queryClient.invalidateQueries({ queryKey: ["admin-runs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Tag steps are keyed by mention; the mentions step says which place each one is.
  const names = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!run) return map;
    const byIndex = new Map<string, string>();
    for (const s of run.steps) {
      if (s.stage === "resolve") {
        const name = (obj(obj(s.input).place).name as string | undefined) ?? (obj(s.output).placeName as string | undefined);
        if (name) byIndex.set(s.key, name);
      }
    }
    const mentions = run.steps.find((s) => s.stage === "mentions");
    const list = obj(mentions?.output).mentions;
    if (Array.isArray(list)) {
      for (const m of list as { index?: number; reviewId?: string }[]) {
        const name = m.index != null ? byIndex.get(String(m.index)) : undefined;
        if (m.reviewId && name) map.set(m.reviewId, name);
      }
    }
    return map;
  }, [run]);

  const duration = run?.finishedAt ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime() : null;

  return (
    <AdminShell wide>
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/admin/runs" className="hover:text-foreground hover:underline" data-testid="link-all-runs">
          History
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">{run?.post ? `@${run.post.authorHandle}'s post` : run?.place?.name ?? "Run"}</span>
      </nav>
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : !run ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{(error as Error | null)?.message ?? "Run not found"}</p>
      ) : (
        <div className={run.post ? "grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start" : ""}>
          {run.post ? (
            <PostEmbed
              permalink={run.post.url}
              author={run.post.authorHandle}
              label={`Posted ${run.post.postedAt ? formatDistanceToNowStrict(new Date(run.post.postedAt), { addSuffix: true }) : ""}`.trim()}
              actions={
                <Button variant="ghost" size="icon-sm" aria-label="Edit this post's places" className="text-muted-foreground" onClick={() => setEditing(true)} data-testid="button-run-edit-post">
                  <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
                </Button>
              }
              className="lg:sticky lg:top-0"
            />
          ) : null}
          <div className="min-w-0 space-y-4">
            {run.place ? (
              <div data-testid="run-subject-place">
                <Link href={`/places/${run.place.googlePlaceId}`} className="font-brand text-[15px] font-semibold hover:underline">
                  {run.place.name}
                </Link>
                <p className="text-xs text-muted-foreground">{run.place.formattedAddress}</p>
              </div>
            ) : null}

            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground" data-testid="text-run-summary">
              <StatusDot status={run.status} />
              <span className="text-foreground">{run.status.replace("_", " ")}</span>
              <span>· {TRIGGER_LABEL[run.trigger] ?? run.trigger.replace("_", " ")}</span>
              {run.fromStage && <span>· from {STAGE_LABEL[run.fromStage] ?? run.fromStage}</span>}
              <span>· {formatDistanceToNowStrict(new Date(run.startedAt), { addSuffix: true })}</span>
              {duration != null && <span>· {formatDuration(duration)}</span>}
              <span>· {formatCost(run.costUsd)}</span>
            </p>
            {run.error && <p className="text-xs text-destructive">{run.error}</p>}

            <div className="rounded-xl border p-2" data-testid="list-run-steps">
              {run.steps.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No steps yet.</p>
              ) : (
                run.steps.map((s) => (
                  <TraceStep
                    key={s.id}
                    label={stepLabel(s, names)}
                    secondary={[stepOutcome(s), shortModel(s.model), s.costUsd ? formatCost(s.costUsd) : null, formatDuration(s.latencyMs), s.attempt > 1 ? `try ${s.attempt}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    running={s.status === "running"}
                    failed={s.status === "failed"}
                  >
                    {stepSummary(s, names) && <p className={cn("py-1 text-sm", s.status === "failed" ? "text-destructive" : "text-foreground/90")}>{stepSummary(s, names)}</p>}
                    {(s.tokensIn > 0 || s.agentVersion) && (
                      <p className="py-1 text-xs text-muted-foreground">
                        {[
                          s.agentVersion ? `${s.agentVersion.agentKey} v${s.agentVersion.version}` : null,
                          s.tokensIn ? `${s.tokensIn.toLocaleString()} in` : null,
                          s.tokensCached ? `${s.tokensCached.toLocaleString()} cached` : null,
                          s.tokensOut ? `${s.tokensOut.toLocaleString()} out` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <TraceStep label="Raw data">
                      <JsonBlock label="Input" value={s.input} />
                      <JsonBlock label="Output" value={s.output} />
                    </TraceStep>
                    {RERUNNABLE.has(s.stage) && (run.post || s.stage === "aggregate" || s.stage === "summarize") && (
                      <div className="py-1">
                        <Button variant="outline" size="sm" disabled={rerun.isPending} onClick={() => rerun.mutate(s.stage)} data-testid={`button-rerun-${s.stage}-${s.key || "0"}`}>
                          Re-run from here
                        </Button>
                      </div>
                    )}
                  </TraceStep>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {run?.post && <MentionEditor postId={run.post.id} open={editing} onOpenChange={setEditing} />}
    </AdminShell>
  );
}
