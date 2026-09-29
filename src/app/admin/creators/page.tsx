"use client";

/**
 * Admin → Creators: the Instagram accounts Townsquare pulls posts from.
 * Add one by handle; each row opens that creator's posts.
 */

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, MoreHorizontalIcon, RepeatIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/shared/status-dot";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminFetch } from "@/components/admin/admin-fetch";
import { BackfillProgressCard, ReprocessDialog } from "@/components/admin/reprocess";
import { lastSyncLabel, sourceStatus, type SourceSummary } from "@/components/admin/source-meta";
import { queryClient } from "@/lib/query-client";

function CreatorRow({ source }: { source: SourceSummary }) {
  const name = source.user?.name;
  return (
    <Link
      href={`/admin/creators/${source.handle}`}
      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted"
      data-testid={`row-creator-${source.handle}`}
    >
      <Avatar className="size-10">
        <AvatarImage src={source.user?.avatar ?? undefined} alt={source.handle} />
        <AvatarFallback>{source.handle.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          @{source.handle}
          {name && <span className="font-normal text-muted-foreground"> · {name}</span>}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <StatusDot status={sourceStatus(source)} />
          {[source.status === "paused" ? "Syncing paused" : lastSyncLabel(source), `${source.posts} posts`, `${source.places} places`].join(" · ")}
        </p>
      </div>
      {source.needsReview > 0 && <span className="shrink-0 text-xs text-amber-600">{source.needsReview} to review</span>}
      {source.failed > 0 && <span className="shrink-0 text-xs text-red-600">{source.failed} failed</span>}
      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export default function CreatorsPage() {
  const [handle, setHandle] = React.useState("");
  const [reprocessing, setReprocessing] = React.useState(false);
  const { data, isLoading } = useQuery<{ sources: SourceSummary[] }>({
    queryKey: ["admin-sources"],
    queryFn: () => adminFetch("/api/admin/sources"),
    refetchInterval: (q) => (q.state.data?.sources.some((s) => ["pending", "queued", "running"].includes(s.lastSync?.status ?? "")) ? 10_000 : false),
  });

  const add = useMutation({
    mutationFn: (h: string) =>
      adminFetch<{ source: { handle: string }; created: boolean; queued: boolean }>("/api/admin/sources", { method: "POST", json: { handle: h } }),
    onSuccess: (res) => {
      setHandle("");
      toast.success(
        res.created
          ? `Added @${res.source.handle}. ${res.queued ? "Pulling their posts now." : "Their posts sync once the runner is up."}`
          : `@${res.source.handle} is already here. ${res.queued ? "Syncing them now." : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't add that creator"),
  });

  const sources = data?.sources ?? [];

  return (
    <AdminShell
      actions={
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (handle.trim()) add.mutate(handle.trim());
            }}
            className="flex items-center gap-2"
          >
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="h-8 w-32 sm:w-48" data-testid="input-source-handle" />
            <Button type="submit" size="sm" disabled={!handle.trim() || add.isPending} data-testid="button-add-source">
              {add.isPending ? "Adding..." : "Add creator"}
            </Button>
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" data-testid="button-sources-actions" />}>
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setTimeout(() => setReprocessing(true), 100)} data-testid="button-reprocess-all">
                <HugeiconsIcon icon={RepeatIcon} />
                Re-process all posts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <ReprocessDialog source={null} label="all posts" open={reprocessing} onOpenChange={setReprocessing} />
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">The Instagram accounts Townsquare pulls posts from. New posts sync every morning; open a creator to see theirs.</p>
        <BackfillProgressCard />
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={UserMultipleIcon} className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium">Add your first creator</p>
            <p className="mt-1 text-sm text-muted-foreground">Enter their Instagram handle above.</p>
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border" data-testid="list-sources">
            {sources.map((s) => (
              <CreatorRow key={s.id} source={s} />
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
