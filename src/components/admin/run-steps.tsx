"use client";

/**
 * A post's runs, step by step: what each step does, one line on what
 * happened, and "Details" for the raw call (input, output, agent, tokens)
 * with "Re-run from here". A picker switches between the post's runs.
 */

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/shared/status-dot";
import { adminFetch } from "@/components/admin/admin-fetch";
import { STAGE_LABEL, STATUS_LABEL, TRIGGER_LABEL, formatCost, formatDuration, shortModel, type RunRow } from "@/components/admin/run-format";
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
  agentVersion: { agentKey: string; version: number; agent: { name: string } } | null;
};

type Run = {
  id: string;
  status: string;
  trigger: string;
  fromStage: string | null;
  costUsd: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps: Step[];
};

const RERUNNABLE = new Set(["read", "resolve", "tag", "aggregate", "summarize"]);

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const humanize = (slug: string) => slug.replace(/_/g, " ");

/** A step's name, with the place it was about when there is one. */
function stepLabel(step: Step, names: Map<string, string>) {
  const stage = STAGE_LABEL[step.stage] ?? step.stage;
  const name =
    step.stage === "resolve"
      ? (obj(obj(step.input).place).name as string | undefined) ?? (obj(step.output).placeName as string | undefined)
      : step.stage === "tag"
        ? names.get(step.key)
        : undefined;
  return name ? `${stage}: ${name}` : stage;
}

/** What the step did, in a line. */
function stepSummary(step: Step): string | null {
  const out = obj(step.output);
  if (step.status === "failed") return step.error ? `Failed: ${step.error}` : "Failed";
  if (step.status === "running") return "Running…";
  if (step.status === "skipped" || out.skipped) return `Skipped: ${String(out.reason ?? "nothing changed")}`;
  switch (step.stage) {
    case "read": {
      if (out.postType === "not_a_place") return `Not about a place${out.notPlaceReason ? `: ${String(out.notPlaceReason)}` : "."}`;
      const places = arr(out.places).map((p) => String(obj(p).name));
      return places.length ? `Found ${places.length === 1 ? "1 place" : `${places.length} places`}: ${places.join(", ")}.` : "Found no places.";
    }
    case "resolve":
      return out.outcome === "accepted"
        ? `Matched it to ${String(out.placeName ?? "a place")}.`
        : `Not sure which place this is, so it asked you${arr(out.candidates).length ? ` (${arr(out.candidates).length} possible matches)` : ""}.`;
    case "mentions": {
      const saved = arr(out.mentions).length;
      const removed = Number(out.removed ?? 0);
      if (!saved && !removed) return "Nothing to save.";
      return `Saved ${saved === 1 ? "1 place" : `${saved} places`} to the map${removed ? `, removed ${removed}` : ""}.`;
    }
    case "tag": {
      const kept = arr(out.kept).map((t) => humanize(String(obj(t).slug)));
      return kept.length ? `${kept.join(", ")}.` : "No tags.";
    }
    case "aggregate":
      return "Recounted the place's tags and dishes from every post.";
    case "summarize":
      return out.summary ? `“${String(out.summary)}”` : null;
    default:
      return null;
  }
}

/** The agent's own reason, when it gave one. */
function stepReason(step: Step): string | null {
  const reason = obj(obj(step.output).agent).reason;
  return typeof reason === "string" && reason ? reason : null;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function StepRow({ step, names, onRerun, rerunning }: { step: Step; names: Map<string, string>; onRerun?: () => void; rerunning: boolean }) {
  const [open, setOpen] = React.useState(false);
  const asked = step.stage === "resolve" && obj(step.output).outcome === "review";
  const summary = stepSummary(step);
  const reason = stepReason(step);
  const meta = [shortModel(step.model), step.costUsd ? formatCost(step.costUsd) : null].filter(Boolean).join(" · ");
  return (
    <li className="flex gap-2.5 py-2.5" data-testid={`step-${step.stage}-${step.key || "0"}`}>
      <span className="pt-1.5">
        <StatusDot status={asked ? "needs_review" : step.status} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{stepLabel(step, names)}</p>
          {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
        </div>
        {summary && <p className={cn("text-sm", step.status === "failed" ? "text-destructive" : "text-foreground/90")}>{summary}</p>}
        {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          data-testid={`button-step-details-${step.stage}-${step.key || "0"}`}
        >
          Details
          <HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowRight01Icon} className="size-3" />
        </button>
        {open && (
          <div className="space-y-2 pt-1">
            {(step.agentVersion || step.tokensIn > 0) && (
              <p className="text-xs text-muted-foreground">
                {[
                  step.agentVersion ? `${step.agentVersion.agent.name} v${step.agentVersion.version}` : null,
                  step.tokensIn ? `${step.tokensIn.toLocaleString()} in` : null,
                  step.tokensCached ? `${step.tokensCached.toLocaleString()} cached` : null,
                  step.tokensOut ? `${step.tokensOut.toLocaleString()} out` : null,
                  formatDuration(step.latencyMs),
                  step.attempt > 1 ? `try ${step.attempt}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <JsonBlock label="Input" value={step.input} />
            <JsonBlock label="Output" value={step.output} />
            {onRerun && (
              <Button variant="outline" size="sm" disabled={rerunning} onClick={onRerun} data-testid={`button-rerun-${step.stage}-${step.key || "0"}`}>
                Re-run from here
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function RunSteps({
  postId,
  onReadNow,
  reading,
  rerunToken = 0,
}: {
  postId: string;
  onReadNow: () => void;
  reading: boolean;
  /** Bumped when the post is re-run from outside: wait for the new run. */
  rerunToken?: number;
}) {
  // null: the latest run.
  const [runId, setRunId] = React.useState<string | null>(null);
  // After a re-run: the newest run before it, until a newer one appears (for up to 90s).
  const [waiting, setWaiting] = React.useState<{ from: string | null; until: number } | null>(null);
  React.useEffect(() => {
    setRunId(null);
    setWaiting(null);
  }, [postId]);

  const { data: list, isLoading: loadingList } = useQuery<{ runs: RunRow[] }>({
    queryKey: ["admin-post-runs", postId],
    queryFn: () => adminFetch(`/api/admin/runs?post=${postId}&kind=post`),
    refetchInterval: (q) => {
      const newest = q.state.data?.runs[0];
      if (["queued", "running"].includes(newest?.status ?? "")) return 3000;
      return waiting && (newest?.id ?? null) === waiting.from && Date.now() < waiting.until ? 2000 : false;
    },
  });
  const runs = list?.runs ?? [];
  const newestId = runs[0]?.id ?? null;
  const expect = React.useCallback(() => {
    setRunId(null);
    setWaiting({ from: newestId, until: Date.now() + 90_000 });
  }, [newestId]);
  React.useEffect(() => {
    if (rerunToken) expect();
    // Only a new token starts a wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerunToken]);
  React.useEffect(() => {
    if (waiting && newestId !== waiting.from) setWaiting(null);
  }, [newestId, waiting]);
  const shownId = runId ?? runs[0]?.id ?? null;
  const index = runs.findIndex((r) => r.id === shownId);

  const { data, isLoading } = useQuery<{ run: Run }>({
    queryKey: ["admin-run", shownId],
    queryFn: () => adminFetch(`/api/admin/runs/${shownId}`),
    enabled: !!shownId,
    refetchInterval: (q) => (["queued", "running"].includes(q.state.data?.run.status ?? "") ? 3000 : false),
  });
  const run = data?.run;

  const live = ["queued", "running"].includes(run?.status ?? "");
  const wasLive = React.useRef(false);
  React.useEffect(() => {
    if (wasLive.current && !live) {
      for (const key of ["admin-post", "admin-posts", "admin-review", "admin-post-runs"]) queryClient.invalidateQueries({ queryKey: [key] });
    }
    wasLive.current = live;
  }, [live]);

  const rerun = useMutation({
    mutationFn: (fromStage: string) => adminFetch<{ queued: boolean }>(`/api/admin/runs/${shownId}`, { method: "POST", json: { fromStage } }),
    onSuccess: (r, fromStage) => {
      toast.success(r.queued ? `Re-running from “${STAGE_LABEL[fromStage] ?? fromStage}”` : "The runner isn't reachable; try again");
      if (r.queued) expect();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Tag steps are keyed by mention; the mentions step says which place each one is.
  const names = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!run) return map;
    const byIndex = new Map<string, string>();
    for (const s of run.steps) {
      if (s.stage !== "resolve") continue;
      const name = (obj(obj(s.input).place).name as string | undefined) ?? (obj(s.output).placeName as string | undefined);
      if (name) byIndex.set(s.key, name);
    }
    for (const m of arr(obj(run.steps.find((s) => s.stage === "mentions")?.output).mentions) as { index?: number; reviewId?: string }[]) {
      const name = m.index != null ? byIndex.get(String(m.index)) : undefined;
      if (m.reviewId && name) map.set(m.reviewId, name);
    }
    return map;
  }, [run]);

  if (loadingList) return <Skeleton className="h-48 w-full" />;
  if (runs.length === 0) {
    return (
      <div className="space-y-3 py-2" data-testid="text-not-read">
        <p className="text-sm text-muted-foreground">The engine hasn&apos;t read this post yet. It came in before the engine existed, so the old importer chose its places.</p>
        <Button variant="outline" size="sm" onClick={onReadNow} disabled={reading} data-testid="button-read-now">
          {reading ? "Starting…" : "Read it now"}
        </Button>
      </div>
    );
  }

  const duration = run?.finishedAt ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime() : null;
  const when = (r: { startedAt: string }) => formatDistanceToNowStrict(new Date(r.startedAt), { addSuffix: true });

  return (
    <div data-testid="run-steps">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        {runs.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs" data-testid="select-run" />}>
              Run {runs.length - index} of {runs.length}
              <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[240px]">
              {runs.map((r, i) => (
                <DropdownMenuItem key={r.id} onClick={() => setRunId(i === 0 ? null : r.id)} data-testid={`option-run-${i}`}>
                  <StatusDot status={r.status} />
                  <span>{TRIGGER_LABEL[r.trigger] ?? r.trigger}</span>
                  <span className="text-xs text-muted-foreground">{when(r)}</span>
                  <HugeiconsIcon icon={Tick01Icon} className={cn("ml-auto h-4 w-4", r.id === shownId ? "opacity-100" : "opacity-0")} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {run && (
          <>
            <StatusDot status={run.status} />
            <span className="text-foreground">{STATUS_LABEL[run.status] ?? run.status}</span>
            <span>· {TRIGGER_LABEL[run.trigger] ?? run.trigger}</span>
            <span>· {when(run)}</span>
            {duration != null && <span>· {formatDuration(duration)}</span>}
            <span>· {formatCost(run.costUsd)}</span>
          </>
        )}
        {waiting && <span className="text-foreground">· waiting for the new run…</span>}
      </div>
      {run?.error && <p className="pt-2 text-xs text-destructive">{run.error}</p>}
      {isLoading || !run ? (
        <Skeleton className="mt-3 h-40 w-full" />
      ) : (
        <ol className="divide-y" data-testid="list-run-steps">
          {run.steps.map((s) => (
            <StepRow
              key={s.id}
              step={s}
              names={names}
              rerunning={rerun.isPending}
              onRerun={RERUNNABLE.has(s.stage) ? () => rerun.mutate(s.stage) : undefined}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
