"use client";

/**
 * Admin → Review: what the engine wasn't sure about, highest priority and
 * oldest first. A row opens the post window on that question; answering
 * moves on to the next. J / K move and Enter opens.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, TaskDone01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/shared/status-dot";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminFetch } from "@/components/admin/admin-fetch";
import { KIND_LABEL, PostModal, type ReviewKind } from "@/components/admin/post-modal";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  kind: ReviewKind;
  question: string;
  createdAt: string;
  postId: string | null;
  handle: string | null;
  caption: string | null;
};

type ReviewData = { items: Item[]; counts: Partial<Record<ReviewKind, number>>; total: number };
/** One row per post: its first question, and how many more it has. */
type Row = Item & { more: number };

const KINDS: ReviewKind[] = ["confirm_place", "check_not_a_place", "fix_extraction", "failed_run", "spot_check", "confirm_example"];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export default function ReviewPage() {
  const [kind, setKind] = React.useState<ReviewKind | "all">("all");
  const [selected, setSelected] = React.useState(0);
  // The open post (rows are posts), and the list's order when it was opened.
  const [openPostId, setOpenPostId] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<string[]>([]);
  const rowRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const { data, isLoading } = useQuery<ReviewData>({
    queryKey: ["admin-review", kind],
    queryFn: () => adminFetch(`/api/admin/review${kind === "all" ? "" : `?kind=${kind}`}`),
  });
  // The post window answers every question on a post, so the list is one row per post.
  const items = React.useMemo(() => {
    const byPost = new Map<string, Row>();
    for (const i of data?.items ?? []) {
      if (!i.postId) continue;
      const first = byPost.get(i.postId);
      if (first) first.more += 1;
      else byPost.set(i.postId, { ...i, more: 0 });
    }
    return [...byPost.values()];
  }, [data]);
  // Keep the open row while the list refetches without it.
  const [lastOpen, setLastOpen] = React.useState<Row | null>(null);
  const current = items.find((i) => i.postId === openPostId) ?? null;
  React.useEffect(() => {
    if (current) setLastOpen(current);
  }, [current]);
  const openItem = openPostId ? (current ?? lastOpen) : null;

  const open = (index: number) => {
    const row = items[index];
    if (!row?.postId) return;
    setSelected(index);
    setOrder(items.map((i) => i.postId!));
    setOpenPostId(row.postId);
  };

  React.useEffect(() => setSelected(0), [kind]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openPostId || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setSelected((s) => {
          const next = Math.max(0, Math.min(items.length - 1, s + (e.key === "j" ? 1 : -1)));
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && items[selected]) {
        e.preventDefault();
        open(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /**
   * The next post still waiting, in the order the list had when a post was
   * opened (answered posts drop out, and a post's row moves as its first
   * question changes); then any skipped one from the top.
   */
  const next = () => {
    const waiting = new Set(items.map((i) => i.postId));
    const from = order.indexOf(openPostId ?? "");
    const following = order.slice(from + 1).find((id) => waiting.has(id)) ?? items.find((i) => i.postId !== openPostId)?.postId ?? null;
    if (following) {
      setSelected(Math.max(0, items.findIndex((i) => i.postId === following)));
      setOpenPostId(following);
    } else {
      setOpenPostId(null);
    }
  };

  const count = (k: ReviewKind | "all") => (k === "all" ? data?.total : data?.counts[k]) ?? 0;
  const kindLabel = kind === "all" ? "Everything" : KIND_LABEL[kind];

  return (
    <AdminShell>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Posts the engine wasn&apos;t sure about{items.length ? `: ${count(kind)} ${count(kind) === 1 ? "question" : "questions"} on ${items.length} ${items.length === 1 ? "post" : "posts"}` : ""}. Answer one and the next opens.
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="shrink-0" data-testid="select-review-kind" />}>
            {kindLabel} <span className="text-muted-foreground tabular-nums">{count(kind)}</span>
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onClick={() => setKind("all")} data-testid="option-review-kind-all">
              Everything
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count("all")}</span>
              <HugeiconsIcon icon={Tick01Icon} className={cn("h-4 w-4", kind === "all" ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {KINDS.filter((k) => count(k) > 0 || k === kind).map((k) => (
              <DropdownMenuItem key={k} onClick={() => setKind(k)} data-testid={`option-review-kind-${k}`}>
                {KIND_LABEL[k]}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count(k)}</span>
                <HugeiconsIcon icon={Tick01Icon} className={cn("h-4 w-4", kind === k ? "opacity-100" : "opacity-0")} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16" data-testid="text-review-empty">
          <HugeiconsIcon icon={TaskDone01Icon} className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="font-medium">Nothing to review</p>
          <p className="text-sm text-muted-foreground mt-1">New questions show up here as the engine reads posts.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y" data-testid="list-review-items">
            {items.map((item, i) => (
              <button
                key={item.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                type="button"
                onClick={() => open(i)}
                onMouseEnter={() => setSelected(i)}
                className={cn("flex flex-col gap-0.5 rounded-lg px-2 py-2.5 text-left transition-colors", i === selected && "bg-muted")}
                data-testid={`row-review-${item.id}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot status={item.kind === "failed_run" ? "failed" : "needs_review"} />
                  <span className="truncate text-sm font-medium">
                    {item.question}
                    {item.more > 0 && <span className="font-normal text-muted-foreground"> (+{item.more} more)</span>}
                  </span>
                </span>
                <span className="truncate pl-4 text-xs text-muted-foreground">
                  {[
                    KIND_LABEL[item.kind],
                    `@${item.handle ?? "unknown"}`,
                    formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true }),
                    item.caption?.replace(/\s+/g, " ").trim() || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd> to move, <Kbd>Enter</Kbd> to open
          </p>
        </>
      )}

      <PostModal
        postId={openPostId}
        itemId={openItem?.id ?? null}
        position={{ index: Math.max(0, order.indexOf(openPostId ?? "")), total: order.length }}
        open={!!openPostId}
        onOpenChange={(o) => !o && setOpenPostId(null)}
        onNext={next}
      />
    </AdminShell>
  );
}
