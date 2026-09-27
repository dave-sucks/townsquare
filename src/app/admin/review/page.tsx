"use client";

/**
 * The review queue: results waiting for a person, highest priority and oldest
 * first. Tabs filter by kind (with counts); J / K move, Enter opens the post
 * in the mention editor, and resolving an item moves on to the next.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon, TaskDone01Icon } from "@hugeicons/core-free-icons";
import { AppShell, PageHeader } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Kbd } from "@/components/ui/kbd";
import { FallbackImg } from "@/components/chat/trace-items";
import { StatusDot } from "@/components/shared/status-dot";
import { MentionEditor } from "@/components/admin/mention-editor";
import { useAuth } from "@/hooks/use-auth";
import { adminFetch } from "@/components/admin/admin-fetch";
import { cn } from "@/lib/utils";

type Kind = "confirm_place" | "check_not_a_place" | "fix_extraction" | "failed_run" | "spot_check" | "confirm_example";

type Item = {
  id: string;
  kind: Kind;
  question: string;
  createdAt: string;
  postId: string | null;
  shortcode: string | null;
  handle: string | null;
  mediaUrl: string | null;
  caption: string | null;
};

type ReviewData = { items: Item[]; counts: Partial<Record<Kind, number>>; total: number };

const KINDS: { value: Kind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirm_place", label: "Confirm place" },
  { value: "check_not_a_place", label: "Not a place" },
  { value: "fix_extraction", label: "Fix extraction" },
  { value: "failed_run", label: "Failed" },
  { value: "spot_check", label: "Spot check" },
  { value: "confirm_example", label: "Confirm example" },
];

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<Kind, string>;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export default function ReviewPage() {
  const { user } = useAuth();
  const [kind, setKind] = React.useState<Kind | "all">("all");
  const [selected, setSelected] = React.useState(0);
  const [open, setOpen] = React.useState<Item | null>(null);
  const rowRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const { data, isLoading } = useQuery<ReviewData>({
    queryKey: ["admin-review", kind],
    queryFn: () => adminFetch(`/api/admin/review${kind === "all" ? "" : `?kind=${kind}`}`),
  });
  const items = React.useMemo(() => (data?.items ?? []).filter((i) => i.postId), [data]);

  React.useEffect(() => setSelected(0), [kind]);
  React.useEffect(() => {
    if (selected >= items.length && items.length > 0) setSelected(items.length - 1);
  }, [items.length, selected]);

  // J / K move, Enter opens. Off while the editor is open or a field has focus.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setSelected((s) => {
          const next = Math.max(0, Math.min(items.length - 1, s + (e.key === "j" ? 1 : -1)));
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && items[selected]) {
        e.preventDefault();
        setOpen(items[selected]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selected, open]);

  // Resolving moves on to the next item (the list refetches without this one).
  const next = () => {
    if (!open) return;
    const at = items.findIndex((i) => i.id === open.id);
    const following = items.slice(at + 1).find((i) => i.id !== open.id) ?? null;
    if (following) {
      setSelected(Math.max(0, at));
      setOpen(following);
    } else {
      setOpen(null);
    }
  };

  const count = (k: Kind | "all") => (k === "all" ? data?.total : data?.counts[k]) ?? 0;

  return (
    <AppShell user={user}>
      <PageHeader title="Review" />
      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full pb-20 md:pb-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind | "all")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <TabsList className="w-max justify-start" data-testid="tabs-review-kind">
            {/* Kinds with nothing waiting stay out of the way (the selected one stays). */}
            {KINDS.filter((k) => k.value === "all" || k.value === kind || count(k.value) > 0).map((k) => (
              <TabsTrigger key={k.value} value={k.value} data-testid={`tab-review-${k.value}`}>
                {k.label}
                <span className="ml-1 text-xs text-muted-foreground tabular-nums">{count(k.value)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-4">
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
              <p className="text-sm text-muted-foreground mt-1">New items show up here as the engine runs.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col" data-testid="list-review-items">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => {
                      setSelected(i);
                      setOpen(item);
                    }}
                    onMouseEnter={() => setSelected(i)}
                    className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors", i === selected && "bg-muted")}
                    data-testid={`row-review-${item.id}`}
                  >
                    <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.mediaUrl ? (
                        <FallbackImg
                          src={item.mediaUrl}
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
                      <p className="truncate text-sm font-medium">{item.question}</p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <StatusDot status={item.kind === "failed_run" ? "failed" : "needs_review"} />
                        <span className="truncate">
                          {[
                            kind === "all" ? KIND_LABEL[item.kind] : null,
                            `@${item.handle ?? "unknown"}`,
                            formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true }),
                            item.caption?.replace(/\s+/g, " ").trim() || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-4 hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd> to move, <Kbd>Enter</Kbd> to open
              </p>
            </>
          )}
        </div>
      </div>

      <MentionEditor
        postId={open?.postId ?? null}
        reviewItemId={open?.id ?? null}
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        onDone={next}
      />
    </AppShell>
  );
}
