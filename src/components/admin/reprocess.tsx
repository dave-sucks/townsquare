"use client";

/**
 * "Re-process all": the confirm dialog (what it will do, what it will cost,
 * how long it takes) and the progress card while it runs. Scope is one
 * source, or every post when source is null.
 */

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/shared/status-dot";
import { adminFetch } from "@/components/admin/admin-fetch";
import { queryClient } from "@/lib/query-client";

type Estimate = { posts: number; perPostUsd: number; totalUsd: number; minutes: number; basis: string };
type BackfillProgress = {
  id: string;
  sourceId: string | null;
  posts: number;
  estimateUsd: number;
  startedAt: string;
  done: number;
  completed: number;
  needsReview: number;
  failed: number;
  running: number;
  costUsd: number;
  finished: boolean;
  /** The source it covered; null when it covered every post. */
  handle: string | null;
};
type BackfillData = { scope: { sourceId: string | null; handle: string | null }; reviewed: number; estimate: Estimate; latest: BackfillProgress | null };

const money = (usd: number) => (usd < 10 ? `$${usd.toFixed(2)}` : `$${Math.round(usd)}`);
const duration = (minutes: number) =>
  minutes < 90 ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : `${Math.round((minutes / 60) * 10) / 10} hours`;

/** The estimate for a scope and its latest re-process (anyScope: the latest of any scope). */
export function useBackfill(source: string | null, enabled = true, anyScope = false) {
  return useQuery<BackfillData>({
    queryKey: ["admin-backfill", source ?? "all", anyScope],
    queryFn: () => adminFetch(`/api/admin/backfill?source=${encodeURIComponent(source ?? "all")}${anyScope ? "&latest=any" : ""}`),
    enabled,
    refetchInterval: (q) => (q.state.data?.latest && !q.state.data.latest.finished ? 5000 : false),
  });
}

export function ReprocessDialog({
  source,
  label,
  open,
  onOpenChange,
}: {
  /** A source id or handle; null for every post. */
  source: string | null;
  /** What's being re-processed, e.g. "all posts" or "@girlgottaeatz's posts". */
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useBackfill(source, open);
  const start = useMutation({
    mutationFn: () => adminFetch<{ posts: number }>("/api/admin/backfill", { method: "POST", json: { source } }),
    onSuccess: (r) => {
      toast.success(`Re-processing ${r.posts} posts. Progress shows on Sources.`);
      queryClient.invalidateQueries({ queryKey: ["admin-backfill"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const est = data?.estimate;
  const running = data?.latest && !data.latest.finished;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-reprocess">
        <DialogHeader>
          <DialogTitle>Re-process {label}?</DialogTitle>
          <DialogDescription>
            {est
              ? `Runs ${est.posts} posts through Read, Resolve and Tag again, then refreshes their places. Mentions a person confirmed are kept${data!.reviewed ? `, and the ${data!.reviewed} posts someone already reviewed are skipped` : ""}.`
              : "Runs these posts through Read, Resolve and Tag again, then refreshes their places."}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : est ? (
          <div className="grid grid-cols-2 gap-3" data-testid="reprocess-estimate">
            <div className="rounded-lg border p-3">
              <p className="text-lg font-semibold tabular-nums">About {money(est.totalUsd)}</p>
              <p className="text-xs text-muted-foreground">
                ${est.perPostUsd.toFixed(3)} a post, from {est.basis}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-lg font-semibold tabular-nums">About {duration(est.minutes)}</p>
              <p className="text-xs text-muted-foreground">4 posts at a time</p>
            </div>
          </div>
        ) : null}
        {running && <p className="text-sm text-amber-600">A re-process for this is still running ({data!.latest!.done} of {data!.latest!.posts} done).</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!est || est.posts === 0 || !!running || start.isPending} onClick={() => start.mutate()} data-testid="button-confirm-reprocess">
            {start.isPending ? "Starting..." : est ? `Re-process ${est.posts} posts` : "Re-process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The latest re-process of any scope, while it runs and for a day after. */
export function BackfillProgressCard() {
  const { data } = useBackfill(null, true, true);
  const [now] = React.useState(() => Date.now());
  const b = data?.latest;
  if (!b || (b.finished && now - new Date(b.startedAt).getTime() > 24 * 3600_000)) return null;
  const label = b.handle ? `@${b.handle}'s posts` : "all posts";
  const pct = b.posts ? Math.min(100, Math.round((b.done / b.posts) * 100)) : 100;
  return (
    <Card data-testid="card-backfill-progress">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <StatusDot status={b.finished ? "completed" : "running"} />
            {b.finished ? `Re-processed ${label}` : `Re-processing ${label}`}
          </p>
          <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            {b.done} of {b.posts}
          </span>
        </div>
        <Progress value={pct} aria-label="Re-process progress" />
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            {money(b.costUsd)} so far, of about {money(b.estimateUsd)}
          </span>
          {b.needsReview > 0 && <span className="text-amber-600">{b.needsReview} need review</span>}
          {b.failed > 0 && <span className="text-red-600">{b.failed} failed</span>}
          <span>started {formatDistanceToNowStrict(new Date(b.startedAt), { addSuffix: true })}</span>
          <Link href="/admin/history" className="font-medium text-foreground hover:underline">
            View history
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
