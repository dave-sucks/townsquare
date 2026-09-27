"use client";

/**
 * Runs: every pipeline run, newest first, as dense rows (post or place,
 * status, steps done, cost, duration). Status, kind and source filters live
 * in the URL, so a place's "View runs" link lands filtered.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Activity01Icon, ArrowDown01Icon, Cancel01Icon, Image01Icon, Location01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { AppShell, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { FallbackImg, placePhotoUrl } from "@/components/chat/trace-items";
import { StatusDot } from "@/components/shared/status-dot";
import { adminFetch } from "@/components/admin/admin-fetch";
import { formatCost, formatDuration, type RunRow } from "@/components/admin/run-format";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "Any status" },
  { value: "completed", label: "Completed" },
  { value: "needs_review", label: "Needs review" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
];

const KINDS = [
  { value: "", label: "Posts and places" },
  { value: "post", label: "Post runs" },
  { value: "place", label: "Place runs" },
];

/** An outline filter button with a menu of options, like the profile's place filter. */
function FilterMenu({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-testid={testId} />}>
        {label}
        <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px] max-h-80">
        {options.map((o, i) => (
          <React.Fragment key={o.value}>
            {i === 1 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => onChange(o.value)} data-testid={`option-${testId}-${o.value || "any"}`}>
              {o.label}
              <HugeiconsIcon icon={Tick01Icon} className={cn("ml-auto h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RunThumb({ run }: { run: RunRow }) {
  const src = run.post?.mediaUrl ?? (run.place?.photoRef ? placePhotoUrl(run.place.photoRef) : null);
  const icon = run.kind === "place" ? Location01Icon : Image01Icon;
  const fallback = (
    <span className="flex size-full items-center justify-center">
      <HugeiconsIcon icon={icon} className="size-4 text-muted-foreground" />
    </span>
  );
  return (
    <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
      {src ? <FallbackImg src={src} referrerPolicy="no-referrer" className="size-full object-cover" fallback={fallback} /> : fallback}
    </div>
  );
}

function RunsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const kind = params.get("kind") ?? "";
  const source = params.get("source") ?? "";
  const place = params.get("place") ?? "";
  const trigger = params.get("trigger") ?? "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  };

  const query = new URLSearchParams(Object.entries({ status, kind, source, place, trigger }).filter(([, v]) => v)).toString();
  const { data, isLoading } = useQuery<{ runs: RunRow[]; sources: string[] }>({
    queryKey: ["admin-runs", query],
    queryFn: () => adminFetch(`/api/admin/runs${query ? `?${query}` : ""}`),
    refetchInterval: (q) => (q.state.data?.runs.some((r) => r.status === "running" || r.status === "queued") ? 5000 : false),
  });
  const runs = data?.runs ?? [];
  const placeName = place ? runs.find((r) => r.place)?.place?.name : null;

  return (
    <>
      <PageHeader title="Runs">
        <FilterMenu
          label={STATUSES.find((s) => s.value === status)?.label ?? "Any status"}
          options={STATUSES}
          value={status}
          onChange={(v) => setParam("status", v)}
          testId="select-run-status"
        />
        <FilterMenu
          label={source ? `@${source}` : "Any source"}
          options={[{ value: "", label: "Any source" }, ...(data?.sources ?? []).map((h) => ({ value: h, label: `@${h}` }))]}
          value={source}
          onChange={(v) => setParam("source", v)}
          testId="select-run-source"
        />
      </PageHeader>

      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full pb-20 md:pb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FilterMenu label={KINDS.find((k) => k.value === kind)?.label ?? "Posts and places"} options={KINDS} value={kind} onChange={(v) => setParam("kind", v)} testId="select-run-kind" />
          {place && (
            <Button variant="secondary" size="sm" onClick={() => setParam("place", "")} data-testid="button-clear-place-filter">
              {placeName ?? "This place"}
              <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
            </Button>
          )}
          {trigger && (
            <Button variant="secondary" size="sm" onClick={() => setParam("trigger", "")} data-testid="button-clear-trigger-filter">
              {trigger === "backfill" ? "Re-process all" : trigger.replace("_", " ")}
              <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={Activity01Icon} className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No runs</p>
            <p className="text-sm text-muted-foreground mt-1">{query ? "Nothing matches these filters." : "Runs show up here as posts go through the engine."}</p>
          </div>
        ) : (
          <div className="flex flex-col" data-testid="list-runs">
            {runs.map((r) => (
              <Link key={r.id} href={`/admin/runs/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted" data-testid={`row-run-${r.id}`}>
                <RunThumb run={r} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.kind === "place" ? r.place?.name ?? "A place" : `@${r.post?.handle ?? "unknown"}`}
                    {r.kind === "post" && r.post?.caption && <span className="font-normal text-muted-foreground"> · {r.post.caption.replace(/\s+/g, " ")}</span>}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <StatusDot status={r.status} />
                    {[
                      r.status.replace("_", " "),
                      `${r.stepsDone}/${r.stepsTotal} steps`,
                      formatCost(r.costUsd),
                      formatDuration(r.durationMs),
                      formatDistanceToNowStrict(new Date(r.startedAt), { addSuffix: true }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function RunsPage() {
  const { user } = useAuth();
  return (
    <AppShell user={user}>
      <React.Suspense fallback={<PageHeader title="Runs" />}>
        <RunsList />
      </React.Suspense>
    </AppShell>
  );
}
