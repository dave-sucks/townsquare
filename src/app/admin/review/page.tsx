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

const KINDS: ReviewKind[] = ["confirm_place", "check_not_a_place", "fix_extraction", "failed_run", "spot_check", "confirm_example"];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export default function ReviewPage() {
  const [kind, setKind] = React.useState<ReviewKind | "all">("all");
  const [selected, setSelected] = React.useState(0);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const rowRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const { data, isLoading } = useQuery<ReviewData>({
    queryKey: ["admin-review", kind],
    queryFn: () => adminFetch(`/api/admin/review${kind === "all" ? "" : `?kind=${kind}`}`),
  });
  const items = React.useMemo(() => (data?.items ?? []).filter((i) => i.postId), [data]);
  const openIndex = items.findIndex((i) => i.id === openId);
  // Keep the open item while the list refetches without it.
  const [lastOpen, setLastOpen] = React.useState<Item | null>(null);
  const current = openIndex >= 0 ? items[openIndex] : null;
  React.useEffect(() => {
    if (current) setLastOpen(current);
  }, [current]);
  const openItem = openId ? (current ?? lastOpen) : null;

  React.useEffect(() => setSelected(0), [kind]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openId || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setSelected((s) => {
          const next = Math.max(0, Math.min(items.length - 1, s + (e.key === "j" ? 1 : -1)));
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && items[selected]) {
        e.preventDefault();
        setOpenId(items[selected].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selected, openId]);

  /** The item after the open one (answered items drop out of the list as it refetches). */
  const next = () => {
    const from = openIndex >= 0 ? openIndex : Math.min(selected, items.length - 1);
    const following = items.slice(from + 1).find((i) => i.id !== openId) ?? items.slice(0, from).find((i) => i.id !== openId) ?? null;
    if (following) {
      setSelected(items.indexOf(following));
      setOpenId(following.id);
    } else {
      setOpenId(null);
    }
  };

  const count = (k: ReviewKind | "all") => (k === "all" ? data?.total : data?.counts[k]) ?? 0;
  const kindLabel = kind === "all" ? "Everything" : KIND_LABEL[kind];

  return (
    <AdminShell>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Posts the engine wasn&apos;t sure about. Answer one and the next opens.</p>
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
                onClick={() => {
                  setSelected(i);
                  setOpenId(item.id);
                }}
                onMouseEnter={() => setSelected(i)}
                className={cn("flex flex-col gap-0.5 rounded-lg px-2 py-2.5 text-left transition-colors", i === selected && "bg-muted")}
                data-testid={`row-review-${item.id}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot status={item.kind === "failed_run" ? "failed" : "needs_review"} />
                  <span className="truncate text-sm font-medium">{item.question}</span>
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
        postId={openItem?.postId ?? null}
        itemId={openItem?.id ?? null}
        position={{ index: Math.max(0, openIndex >= 0 ? openIndex : selected), total: items.length }}
        open={!!openId}
        onOpenChange={(o) => !o && setOpenId(null)}
        onNext={next}
      />
    </AdminShell>
  );
}
