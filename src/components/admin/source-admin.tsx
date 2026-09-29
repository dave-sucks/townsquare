"use client";

/**
 * A creator's profile in admin mode: the sync strip under the header, the
 * source menu beside Follow (sync now, pause, home city, notes for the Read
 * agent, trust weight, sync history), and the admin post list behind the
 * Feed tab's filter (every ingested post with its status, each opening the
 * mention editor).
 */

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Clock01Icon,
  Image01Icon,
  Location01Icon,
  Note01Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  RepeatIcon,
  StarIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { FallbackImg } from "@/components/chat/trace-items";
import { StatusDot } from "@/components/shared/status-dot";
import { useAdminMode } from "@/components/admin/admin-mode";
import { AdminMenu, AdminMenuItem } from "@/components/admin/admin-menu";
import { adminFetch } from "@/components/admin/admin-fetch";
import { EditFieldDialog } from "@/components/admin/edit-field-dialog";
import { MentionEditor } from "@/components/admin/mention-editor";
import { SourceMetrics, lastSyncLabel, sourceStatus, type SourceSummary } from "@/components/admin/source-meta";
import { ReprocessDialog, useBackfill } from "@/components/admin/reprocess";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type Sync = { id: string; status: string; createdAt: string; completedAt: string | null; postsFetched: number; since: string | null; error: string | null };
type PostRow = {
  id: string;
  shortcode: string;
  url: string | null;
  caption: string | null;
  postedAt: string | null;
  postType: string | null;
  status: string;
  mentions: number;
  mediaUrl: string | null;
};
type SourceData = { source: SourceSummary | null; syncs: Sync[]; posts?: PostRow[] };

export type PostFilter = "feed" | "all" | "needs_review" | "not_a_place" | "failed";

export const POST_FILTERS: { value: PostFilter; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "all", label: "All posts" },
  { value: "needs_review", label: "Needs review" },
  { value: "not_a_place", label: "Not a place" },
  { value: "failed", label: "Failed" },
];

const TRUST = [
  { value: "0.5", label: "Low", detail: "0.5×" },
  { value: "1", label: "Normal", detail: "1×" },
  { value: "1.5", label: "High", detail: "1.5×" },
  { value: "2", label: "Top", detail: "2×" },
];

/** A creator's source by user id or handle (null when the engine doesn't follow them). Admins only. */
export function useCreatorSource(sourceKey: string) {
  const { isAdmin } = useAdminMode();
  return useQuery<SourceData | null>({
    queryKey: ["admin-source", sourceKey],
    queryFn: async () => {
      try {
        return await adminFetch<SourceData>(`/api/admin/sources/${sourceKey}`);
      } catch {
        return null;
      }
    },
    enabled: isAdmin,
    // While a sync runs, keep the strip current.
    refetchInterval: (q) => (["pending", "queued", "running"].includes(q.state.data?.source?.lastSync?.status ?? "") ? 10_000 : false),
  });
}

function useSourceWrite(sourceKey: string, sourceId: string | undefined) {
  return useMutation({
    mutationFn: ({ method, body }: { method: "PATCH" | "POST"; body?: Record<string, unknown> }) =>
      adminFetch<{ ok: boolean; queued?: boolean }>(`/api/admin/sources/${sourceId}`, { method, json: body ?? {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-source", sourceKey] });
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Under the profile header: status dot, last sync, and the metrics line. */
export function SourceSyncStrip({ userId }: { userId: string }) {
  const { data } = useCreatorSource(userId);
  const source = data?.source;
  const { data: backfill } = useBackfill(source?.id ?? null, !!source);
  if (!source) return null;
  const reprocess = backfill?.latest && !backfill.latest.finished ? backfill.latest : null;
  return (
    <div className="flex flex-col gap-1 px-3 pb-3" data-testid="strip-source-sync">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <StatusDot status={sourceStatus(source)} />
        {source.status === "paused" ? "Syncing paused" : lastSyncLabel(source)}
        {source.homeCity ? ` · ${source.homeCity}` : ""}
      </p>
      <SourceMetrics source={source} />
      {reprocess && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-source-reprocess">
          <StatusDot status="running" />
          Re-processing {reprocess.done} of {reprocess.posts} posts
        </p>
      )}
    </div>
  );
}

/** The pencil menu beside Follow. */
export function SourceAdminMenu({ sourceKey, onAdminPage = false }: { sourceKey: string; onAdminPage?: boolean }) {
  const { data } = useCreatorSource(sourceKey);
  const source = data?.source;
  const write = useSourceWrite(sourceKey, source?.id);
  const [editing, setEditing] = React.useState<null | "homeCity" | "notes" | "history" | "reprocess">(null);
  if (!source) return null;

  const openEditor = (which: "homeCity" | "notes" | "history" | "reprocess") => setTimeout(() => setEditing(which), 100);
  const patch = (body: Record<string, unknown>, done?: string) =>
    write.mutate(
      { method: "PATCH", body },
      {
        onSuccess: () => {
          setEditing(null);
          if (done) toast.success(done);
        },
      },
    );
  const syncing = ["pending", "queued", "running"].includes(source.lastSync?.status ?? "");

  return (
    <>
      <AdminMenu label="Creator settings" testId="source-admin" onAdminPage={onAdminPage}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sync</DropdownMenuLabel>
          <AdminMenuItem
            icon={RefreshIcon}
            label={syncing ? "Syncing now" : "Sync now"}
            value={syncing ? undefined : lastSyncLabel(source).replace(/^Synced /, "")}
            disabled={syncing || source.status === "paused"}
            onClick={() =>
              write.mutate({ method: "POST" }, { onSuccess: (r) => toast.success(r.queued ? `Syncing @${source.handle}` : "The runner isn't reachable; try again") })
            }
            testId="button-source-sync"
          />
          <AdminMenuItem
            icon={source.status === "paused" ? PlayIcon : PauseIcon}
            label={source.status === "paused" ? "Resume syncing" : "Pause syncing"}
            onClick={() => patch({ status: source.status === "paused" ? "active" : "paused" }, source.status === "paused" ? "Syncing resumed" : "Syncing paused")}
            testId="button-source-pause"
          />
          <AdminMenuItem icon={Clock01Icon} label="Sync history" onClick={() => openEditor("history")} testId="button-source-history" />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Read agent</DropdownMenuLabel>
          <AdminMenuItem icon={Location01Icon} label="Home city" value={source.homeCity ?? "Not set"} onClick={() => openEditor("homeCity")} testId="button-source-home-city" />
          <AdminMenuItem icon={Note01Icon} label="Notes" value={source.notes ? "Set" : "None"} onClick={() => openEditor("notes")} testId="button-source-notes" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="button-source-trust">
              <HugeiconsIcon icon={StarIcon} />
              <span className="flex-1">Trust weight</span>
              <span className="text-xs text-muted-foreground">{source.trustWeight}×</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={String(source.trustWeight)} onValueChange={(v: string) => patch({ trustWeight: Number(v) })}>
                {TRUST.map((t) => (
                  <DropdownMenuRadioItem key={t.value} value={t.value} closeOnClick data-testid={`button-trust-${t.value}`}>
                    {t.label}
                    <span className="ml-auto pl-3 text-xs text-muted-foreground">{t.detail}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <AdminMenuItem icon={RepeatIcon} label="Re-process all posts" onClick={() => openEditor("reprocess")} testId="button-source-reprocess" />
      </AdminMenu>

      <ReprocessDialog source={source.id} label={`@${source.handle}'s posts`} open={editing === "reprocess"} onOpenChange={(o) => !o && setEditing(null)} />

      <EditFieldDialog
        open={editing === "homeCity"}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Home city"
        initialValue={source.homeCity ?? ""}
        placeholder="e.g. New York, NY"
        saving={write.isPending}
        onSave={(v) => patch({ homeCity: v.trim() || null })}
        testId="source-home-city"
      />
      <EditFieldDialog
        open={editing === "notes"}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Notes for the Read agent"
        initialValue={source.notes ?? ""}
        placeholder="e.g. Posts roundups as carousels; the places are in the alt text."
        multiline
        saving={write.isPending}
        onSave={(v) => patch({ notes: v.trim() || null })}
        testId="source-notes"
      />
      <Dialog open={editing === "history"} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-testid="dialog-sync-history">
          <DialogHeader>
            <DialogTitle>Sync history</DialogTitle>
            <DialogDescription>@{source.handle}&apos;s last {data?.syncs.length ?? 0} syncs.</DialogDescription>
          </DialogHeader>
          <div className="-mx-2 max-h-80 overflow-y-auto">
            {(data?.syncs ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm" data-testid={`row-sync-${s.id}`}>
                <StatusDot status={s.status} />
                <span className="flex-1 truncate">{formatDistanceToNowStrict(new Date(s.createdAt), { addSuffix: true })}</span>
                <span className="text-xs text-muted-foreground">{s.error ? <span className="text-destructive">{s.error.slice(0, 60)}</span> : `${s.postsFetched} posts`}</span>
              </div>
            ))}
            {(data?.syncs.length ?? 0) === 0 && <p className="px-2 text-sm text-muted-foreground">No syncs yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The Feed tab's admin filter: the product feed, or every ingested post under a filter. */
export function PostFilterMenu({ value, onChange }: { value: PostFilter; onChange: (v: PostFilter) => void }) {
  const label = POST_FILTERS.find((f) => f.value === value)?.label ?? "Feed";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-testid="select-post-filter" />}>
        {label}
        <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {POST_FILTERS.map((f, i) => (
          <React.Fragment key={f.value}>
            {i === 1 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => onChange(f.value)} data-testid={`option-post-filter-${f.value}`}>
              {f.label}
              <HugeiconsIcon icon={Tick01Icon} className={cn("ml-auto h-4 w-4", value === f.value ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Every ingested post under the filter, as dense rows with a status dot; a row opens the mention editor. */
export function SourcePostList({ userId, filter }: { userId: string; filter: Exclude<PostFilter, "feed"> }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const { data, isLoading } = useQuery<SourceData | null>({
    queryKey: ["admin-source", userId, "posts", filter],
    queryFn: async () => {
      try {
        return await adminFetch<SourceData>(`/api/admin/sources/${userId}?posts=${filter}`);
      } catch {
        return null;
      }
    },
  });
  const posts = data?.posts ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!data?.source) {
    return <p className="px-4 py-12 text-center text-sm text-muted-foreground">The engine doesn&apos;t follow this creator.</p>;
  }
  if (posts.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-muted-foreground" data-testid="text-no-posts">No posts here.</p>;
  }
  return (
    <>
      <div className="flex flex-col p-1.5" data-testid="list-source-posts">
        {posts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p.id)}
            className="flex items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-muted"
            data-testid={`row-post-${p.shortcode}`}
          >
            <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
              {p.mediaUrl ? (
                <FallbackImg
                  src={p.mediaUrl}
                  referrerPolicy="no-referrer"
                  className="size-full object-cover"
                  fallback={
                    <span className="flex size-full items-center justify-center">
                      <HugeiconsIcon icon={Image01Icon} className="size-4 text-muted-foreground" />
                    </span>
                  }
                />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <HugeiconsIcon icon={Image01Icon} className="size-4 text-muted-foreground" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{p.caption?.replace(/\s+/g, " ").trim() || "No caption"}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <StatusDot status={p.status} />
                {[
                  p.postType === "not_a_place" ? "Not a place" : p.mentions === 1 ? "1 place" : `${p.mentions} places`,
                  p.postedAt ? formatDistanceToNowStrict(new Date(p.postedAt), { addSuffix: true }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </button>
        ))}
      </div>
      <MentionEditor postId={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}
