"use client";

/**
 * Admin → Creators → one creator: who they are, how their sync is going, and
 * every post Townsquare pulled from them, shown as the Feed shows it and
 * labeled with what the engine made of it. Each post can be edited, and its
 * history (what the engine did, step by step) is one click away.
 */

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Activity01Icon, ArrowDown01Icon, PencilEdit01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusDot } from "@/components/shared/status-dot";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminFetch } from "@/components/admin/admin-fetch";
import { MentionEditor } from "@/components/admin/mention-editor";
import { PostEmbed } from "@/components/admin/post-embed";
import { SourceAdminMenu, useCreatorSource } from "@/components/admin/source-admin";
import { SourceMetrics, lastSyncLabel, sourceStatus } from "@/components/admin/source-meta";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type Filter = "all" | "needs_review" | "not_a_place" | "failed";
type Post = {
  id: string;
  shortcode: string;
  url: string | null;
  postedAt: string | null;
  postType: string | null;
  status: string;
  places: string[];
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All posts" },
  { value: "needs_review", label: "Needs review" },
  { value: "not_a_place", label: "Not a place" },
  { value: "failed", label: "Failed" },
];

const PAGE = 12;

/** What the label tab says about a post, and its dot. */
function describe(p: Post): { label: string; status: string } {
  const places = p.places.length > 2 ? `${p.places.slice(0, 2).join(", ")} + ${p.places.length - 2} more` : p.places.join(", ");
  if (p.status === "failed") return { label: "Failed", status: "failed" };
  if (p.status === "needs_review" || p.status === "unresolved") return { label: places ? `Needs review · ${places}` : "Needs review", status: "needs_review" };
  if (p.postType === "not_a_place") return { label: "Not a place", status: "pending" };
  if (p.status === "queued") return { label: "Not read yet", status: "queued" };
  return places ? { label: places, status: "completed" } : { label: "No places found", status: "pending" };
}

function TabIcon({ label, icon, onClick, href, testId }: { label: string; icon: typeof Activity01Icon; onClick?: () => void; href?: string; testId: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground" nativeButton={false} render={<Link href={href} />} data-testid={testId} />
          ) : (
            <Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground" onClick={onClick} data-testid={testId} />
          )
        }
      >
        <HugeiconsIcon icon={icon} className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = use(params);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [shown, setShown] = React.useState(PAGE);
  const [editing, setEditing] = React.useState<string | null>(null);
  const { data: sourceData, isLoading: loadingSource } = useCreatorSource(handle);
  const source = sourceData?.source;

  const { data, isLoading } = useQuery<{ posts?: Post[] }>({
    queryKey: ["admin-source", handle, "posts", filter],
    queryFn: () => adminFetch(`/api/admin/sources/${handle}?posts=${filter}`),
  });
  const posts = data?.posts ?? [];
  React.useEffect(() => setShown(PAGE), [filter]);

  const write = useMutation({
    mutationFn: ({ method, body }: { method: "POST" | "PATCH"; body?: Record<string, unknown> }) =>
      adminFetch<{ queued?: boolean }>(`/api/admin/sources/${source!.id}`, { method, json: body ?? {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-source"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const syncing = ["pending", "queued", "running"].includes(source?.lastSync?.status ?? "");
  const paused = source?.status === "paused";

  return (
    <AdminShell actions={source ? <SourceAdminMenu sourceKey={handle} onAdminPage /> : null}>
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/admin/creators" className="hover:text-foreground hover:underline">
          Creators
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">@{handle}</span>
      </nav>

      {loadingSource ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : !source ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Townsquare doesn&apos;t follow @{handle}.</p>
      ) : (
        <div className="space-y-3 rounded-xl border p-4" data-testid="card-creator">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage src={source.user?.avatar ?? undefined} alt={handle} />
              <AvatarFallback>{handle.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">@{source.handle}</p>
              <p className="truncate text-sm text-muted-foreground">
                {[source.user?.name, source.homeCity].filter(Boolean).join(" · ")}
                {source.user?.username && (
                  <>
                    {" · "}
                    <Link href={`/u/${source.user.username}`} className="hover:text-foreground hover:underline">
                      Profile
                    </Link>
                  </>
                )}
                {" · "}
                <a href={`https://www.instagram.com/${source.handle}/`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                  Instagram ↗
                </a>
              </p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot status={sourceStatus(source)} />
            {paused ? "Syncing paused" : lastSyncLabel(source)}
          </p>
          <SourceMetrics source={source} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={syncing || paused || write.isPending}
              onClick={() => write.mutate({ method: "POST" }, { onSuccess: (r) => toast.success(r.queued ? `Syncing @${source.handle}` : "The runner isn't reachable") })}
              data-testid="button-creator-sync"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={write.isPending}
              onClick={() => write.mutate({ method: "PATCH", body: { status: paused ? "active" : "paused" } }, { onSuccess: () => toast.success(paused ? "Syncing resumed" : "Syncing paused") })}
              data-testid="button-creator-pause"
            >
              {paused ? "Resume syncing" : "Pause syncing"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Posts</p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-testid="select-creator-posts" />}>
            {FILTERS.find((f) => f.value === filter)?.label}
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {FILTERS.map((f, i) => (
              <React.Fragment key={f.value}>
                {i === 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => setFilter(f.value)} data-testid={`option-creator-posts-${f.value}`}>
                  {f.label}
                  <HugeiconsIcon icon={Tick01Icon} className={cn("ml-auto h-4 w-4", filter === f.value ? "opacity-100" : "opacity-0")} />
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : posts.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground" data-testid="text-no-posts">
          No posts here.
        </p>
      ) : (
        <div className="mx-auto max-w-xl space-y-8" data-testid="list-creator-posts">
          {posts.slice(0, shown).map((p) => {
            const { label, status } = describe(p);
            return (
              <PostEmbed
                key={p.id}
                permalink={p.url}
                author={handle}
                label={label}
                status={status}
                actions={
                  <>
                    <TabIcon label="What the engine did" icon={Activity01Icon} href={`/admin/runs?post=${p.shortcode}`} testId={`link-post-history-${p.shortcode}`} />
                    <TabIcon label="Edit this post's places" icon={PencilEdit01Icon} onClick={() => setEditing(p.id)} testId={`button-edit-post-${p.shortcode}`} />
                  </>
                }
              />
            );
          })}
          {posts.length > shown && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)} data-testid="button-more-posts">
                Show more ({posts.length - shown})
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && <MentionEditor postId={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </AdminShell>
  );
}
