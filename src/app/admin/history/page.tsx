"use client";

/**
 * Admin → History: every post, newest first, with where it stands and what
 * the engine last did with it. A row opens the post window. Filtered to a
 * creator it is that creator's page: their sync status and controls on top.
 * Filters live in the URL (creator, status, place, and open for a post).
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Cancel01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/shared/status-dot";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminFetch } from "@/components/admin/admin-fetch";
import { PostModal } from "@/components/admin/post-modal";
import { STATUS_LABEL, formatCost } from "@/components/admin/run-format";
import { SourceAdminMenu, useCreatorSource } from "@/components/admin/source-admin";
import { SourceMetrics, lastSyncLabel, sourceStatus, type SourceSummary } from "@/components/admin/source-meta";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  shortcode: string;
  handle: string;
  caption: string | null;
  postedAt: string | null;
  status: "needs_review" | "failed" | "not_a_place" | "unread" | "completed";
  places: string[];
  questions: { id: string; kind: string; question: string }[];
  lastRun: { startedAt: string; costUsd: number } | null;
};
type Page = { posts: Row[]; total: number; hasMore: boolean; place: { name: string } | null };

const STATUSES = [
  { value: "", label: "Any status" },
  { value: "needs_review", label: "Needs you" },
  { value: "failed", label: "Failed" },
  { value: "not_a_place", label: "Not a place" },
  { value: "unread", label: "Not read yet" },
  { value: "completed", label: "Done" },
];

const DOT: Record<Row["status"], string> = { needs_review: "needs_review", failed: "failed", not_a_place: "pending", unread: "pending", completed: "completed" };

const ago = (at: string) => formatDistanceToNowStrict(new Date(at), { addSuffix: true });

/** A row's headline: its question, or what the engine found. */
function headline(p: Row) {
  if (p.questions.length) return p.questions[0].question + (p.questions.length > 1 ? ` (+${p.questions.length - 1} more)` : "");
  if (p.status === "failed") return "The engine couldn't finish this post";
  if (p.status === "not_a_place") return "Not a place";
  if (!p.places.length) return p.status === "unread" ? "No places yet" : "No places found";
  return p.places.length > 3 ? `${p.places.slice(0, 3).join(", ")} + ${p.places.length - 3} more` : p.places.join(", ");
}

function FilterMenu({ label, options, value, onChange, testId }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-testid={testId} />}>
        {label}
        <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-[200px]">
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

/** The creator History is filtered to: who they are, their sync, and its controls. */
function CreatorStrip({ handle }: { handle: string }) {
  const { data, isLoading } = useCreatorSource(handle);
  const source = data?.source;
  const write = useMutation({
    mutationFn: ({ method, body }: { method: "POST" | "PATCH"; body?: Record<string, unknown> }) =>
      adminFetch<{ queued?: boolean }>(`/api/admin/sources/${source!.id}`, { method, json: body ?? {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-source"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!source) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">Townsquare doesn&apos;t follow @{handle}.</p>;
  const syncing = ["pending", "queued", "running"].includes(source.lastSync?.status ?? "");
  const paused = source.status === "paused";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3" data-testid="card-creator">
      <Avatar className="size-10">
        <AvatarImage src={source.user?.avatar ?? undefined} alt={handle} />
        <AvatarFallback>{handle.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">
          @{source.handle}
          <span className="font-normal text-muted-foreground">
            {source.user?.name && ` · ${source.user.name}`}
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
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot status={sourceStatus(source as SourceSummary)} />
          {paused ? "Syncing paused" : lastSyncLabel(source as SourceSummary)}
        </p>
        <SourceMetrics source={source as SourceSummary} />
      </div>
      <div className="flex items-center gap-1">
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
          {paused ? "Resume" : "Pause"}
        </Button>
        <SourceAdminMenu sourceKey={handle} onAdminPage />
      </div>
    </div>
  );
}

function HistoryList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const creator = params.get("creator") ?? "";
  const status = params.get("status") ?? "";
  const place = params.get("place") ?? "";
  const openParam = params.get("open");

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  const { data: sources } = useQuery<{ sources: SourceSummary[] }>({ queryKey: ["admin-sources"], queryFn: () => adminFetch("/api/admin/sources") });

  const query = new URLSearchParams();
  if (creator) query.set("creator", creator);
  if (status) query.set("status", status);
  if (place) query.set("place", place);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<Page>({
    queryKey: ["admin-posts", creator, status, place],
    queryFn: ({ pageParam }) => adminFetch(`/api/admin/posts?${query}&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.reduce((n, p) => n + p.posts.length, 0) : undefined),
  });
  const rows = React.useMemo(() => data?.pages.flatMap((p) => p.posts) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  // The open post: by id, or by the URL's ?open= (an id or shortcode).
  const [openId, setOpenId] = React.useState<string | null>(openParam);
  React.useEffect(() => setOpenId(openParam), [openParam]);
  const openIndex = rows.findIndex((r) => r.id === openId || r.shortcode === openId);
  const close = () => {
    setOpenId(null);
    if (openParam) setParam("open", null);
  };
  const next = () => {
    const following = rows[openIndex + 1];
    if (following) setOpenId(following.id);
    else close();
  };

  const creatorOptions = [{ value: "", label: "Any creator" }, ...(sources?.sources ?? []).map((s) => ({ value: s.handle, label: `@${s.handle}` }))];

  return (
    <div className="space-y-3">
      {creator ? (
        <CreatorStrip handle={creator} />
      ) : (
        <p className="text-sm text-muted-foreground">Every post Townsquare pulled in, and what the engine did with it. Open one to see its places and each step.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu label={creator ? `@${creator}` : "Any creator"} options={creatorOptions} value={creator} onChange={(v) => setParam("creator", v || null)} testId="select-history-creator" />
        <FilterMenu label={STATUSES.find((s) => s.value === status)?.label ?? "Any status"} options={STATUSES} value={status} onChange={(v) => setParam("status", v || null)} testId="select-history-status" />
        {place && (
          <Button variant="secondary" size="sm" onClick={() => setParam("place", null)} data-testid="chip-history-place">
            Mentions {data?.pages[0]?.place?.name ?? "one place"}
            <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{isLoading ? "" : `${total} ${total === 1 ? "post" : "posts"}`}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground" data-testid="text-history-empty">
          No posts match these filters.
        </p>
      ) : (
        <div className="flex flex-col divide-y" data-testid="list-history">
          {rows.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenId(p.id)}
              className="flex flex-col gap-0.5 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted"
              data-testid={`row-post-${p.shortcode}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <StatusDot status={DOT[p.status]} />
                <span className="truncate text-sm font-medium">{headline(p)}</span>
              </span>
              <span className="truncate pl-4 text-xs text-muted-foreground">
                {[
                  STATUS_LABEL[p.status],
                  creator ? null : `@${p.handle}`,
                  p.lastRun ? `read ${ago(p.lastRun.startedAt)}` : p.postedAt ? `posted ${ago(p.postedAt)}` : null,
                  p.lastRun ? formatCost(p.lastRun.costUsd) : null,
                  p.caption,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} data-testid="button-history-more">
            {isFetchingNextPage ? "Loading…" : `Show more (${total - rows.length})`}
          </Button>
        </div>
      )}

      <PostModal
        postId={openIndex >= 0 ? rows[openIndex].id : openId}
        open={!!openId}
        onOpenChange={(o) => !o && close()}
        onNext={openIndex >= 0 ? next : undefined}
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AdminShell>
      <React.Suspense fallback={null}>
        <HistoryList />
      </React.Suspense>
    </AdminShell>
  );
}
