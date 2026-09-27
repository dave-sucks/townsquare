"use client";

/**
 * Sources: the creators the engine follows. Add one by handle in the header;
 * each card (the import page's job card) opens the creator's profile, where
 * admin mode has the sync strip and the source menu.
 */

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon, RepeatIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { AppShell, PageHeader } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/shared/status-dot";
import { SourceMetrics, lastSyncLabel, sourceStatus, type SourceSummary } from "@/components/admin/source-meta";
import { BackfillProgressCard, ReprocessDialog } from "@/components/admin/reprocess";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/query-client";
import { adminFetch } from "@/components/admin/admin-fetch";

function SourceCard({ source }: { source: SourceSummary }) {
  const status = sourceStatus(source);
  const card = (
    <Card className="hover-elevate cursor-pointer" data-testid={`card-source-${source.handle}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={source.user?.avatar ?? undefined} alt={source.handle} />
            <AvatarFallback>{source.handle.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">@{source.handle}</p>
            <p className="text-xs text-muted-foreground truncate">
              {[source.user?.name, source.homeCity, lastSyncLabel(source)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusDot status={status} />
            <span className="text-sm">{source.status === "paused" ? "paused" : status === "new" ? "not synced" : status}</span>
          </div>
        </div>
        <SourceMetrics source={source} className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap" />
        {source.lastSync?.status === "failed" && source.lastSync.error && (
          <p className="text-xs text-destructive mt-2 truncate">{source.lastSync.error}</p>
        )}
      </CardContent>
    </Card>
  );
  const username = source.user?.username;
  return username ? (
    <Link href={`/u/${username}`} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

export default function SourcesPage() {
  const { user } = useAuth();
  const [handle, setHandle] = React.useState("");
  const [reprocessing, setReprocessing] = React.useState(false);
  const { data, isLoading } = useQuery<{ sources: SourceSummary[] }>({
    queryKey: ["admin-sources"],
    queryFn: () => adminFetch("/api/admin/sources"),
    // A sync takes a few minutes; keep the cards current while one runs.
    refetchInterval: (q) => (q.state.data?.sources.some((s) => ["pending", "queued", "running"].includes(s.lastSync?.status ?? "")) ? 10_000 : false),
  });

  const add = useMutation({
    mutationFn: (h: string) =>
      adminFetch<{ source: { handle: string }; created: boolean; queued: boolean }>("/api/admin/sources", { method: "POST", json: { handle: h } }),
    onSuccess: (res) => {
      setHandle("");
      toast.success(
        res.created
          ? `Added @${res.source.handle}. ${res.queued ? "Syncing its posts now." : "Sync it from its profile once the runner is up."}`
          : `@${res.source.handle} is already a source. ${res.queued ? "Syncing it now." : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't add that source"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) add.mutate(handle.trim());
  };

  const sources = data?.sources ?? [];

  return (
    <AppShell user={user}>
      <PageHeader title="Sources">
        <form onSubmit={submit} className="flex items-center gap-2">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle or profile URL"
            className="h-8 w-44 sm:w-60"
            data-testid="input-source-handle"
          />
          <Button type="submit" size="sm" disabled={!handle.trim() || add.isPending} data-testid="button-add-source">
            {add.isPending ? "Adding..." : "Add"}
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
      </PageHeader>
      <ReprocessDialog source={null} label="all posts" open={reprocessing} onOpenChange={setReprocessing} />

      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full pb-20 md:pb-4 space-y-3">
        <BackfillProgressCard />
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={UserMultipleIcon} className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium">No sources yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add a creator&apos;s Instagram handle above.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-sources">
            {sources.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
