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
import { AppShell, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TraceStep } from "@/components/chat/chain-of-thought";
import { FallbackImg } from "@/components/chat/trace-items";
import { StatusDot } from "@/components/shared/status-dot";
import { adminFetch } from "@/components/admin/admin-fetch";
import { MentionEditor } from "@/components/admin/mention-editor";
import { STAGE_LABEL, formatCost, formatDuration, shortModel } from "@/components/admin/run-format";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/query-client";

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

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

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
  const { user } = useAuth();
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

  const mediaUrl = run?.post ? (Array.isArray(run.post.media) ? (run.post.media as { url: string }[]) : [])[0]?.url ?? null : null;
  const duration = run?.finishedAt ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime() : null;

  return (
    <AppShell user={user}>
      <PageHeader title="Run">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/runs" />} data-testid="link-all-runs">
          All runs
        </Button>
      </PageHeader>
      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full pb-20 md:pb-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !run ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{(error as Error | null)?.message ?? "Run not found"}</p>
        ) : (
          <div className="space-y-4">
            {run.post ? (
              <div className="flex gap-3" data-testid="run-subject-post">
                {mediaUrl && <FallbackImg src={mediaUrl} referrerPolicy="no-referrer" className="size-16 shrink-0 rounded-md object-cover" fallback={null} />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-line">{run.post.caption || "No caption."}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>@{run.post.authorHandle}</span>
                    {run.post.postedAt && <span>posted {formatDistanceToNowStrict(new Date(run.post.postedAt), { addSuffix: true })}</span>}
                    {run.post.url && (
                      <a href={run.post.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
                        View post ↗
                      </a>
                    )}
                    <button type="button" className="font-medium text-foreground hover:underline" onClick={() => setEditing(true)} data-testid="button-run-edit-post">
                      Edit post
                    </button>
                  </p>
                </div>
              </div>
            ) : run.place ? (
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
              <span>· {run.trigger.replace("_", " ")}</span>
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
                    {s.error && <p className="py-1 text-xs text-destructive">{s.error}</p>}
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
                    <JsonBlock label="Input" value={s.input} />
                    <JsonBlock label="Output" value={s.output} />
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
        )}
      </div>
      {run?.post && <MentionEditor postId={run.post.id} open={editing} onOpenChange={setEditing} />}
    </AppShell>
  );
}
