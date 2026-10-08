"use client";

/**
 * One window for a post, wherever it opens from (Review, History, a post's
 * pencil): the post on the left, and two tabs.
 *
 * - Summary: the engine's open question, if any, with its answer; then the
 *   places on the post. A question is a step of the run that waited on a
 *   person, so answering it lets the run finish.
 * - Steps: the run itself (see RunSteps).
 *
 * Whole-post actions sit in the footer: not a place, re-run, edit places,
 * skip.
 */

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { NextIcon, PencilEdit01Icon, PinOffIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminFetch } from "@/components/admin/admin-fetch";
import { useAdminMode } from "@/components/admin/admin-mode";
import { IconAction } from "@/components/admin/icon-action";
import { MentionEditor } from "@/components/admin/mention-editor";
import { PlaceSearch, type PickedPlace } from "@/components/admin/place-search";
import { PostEmbed } from "@/components/admin/post-embed";
import { RunSteps } from "@/components/admin/run-steps";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

export type ReviewKind = "confirm_place" | "check_not_a_place" | "fix_extraction" | "failed_run" | "spot_check" | "confirm_example";

export const KIND_LABEL: Record<ReviewKind, string> = {
  confirm_place: "Confirm place",
  check_not_a_place: "Not a place?",
  fix_extraction: "Check places",
  failed_run: "Failed",
  spot_check: "Spot check",
  confirm_example: "Confirm example",
};

type Candidate = { id: string; googlePlaceId: string; name: string; address: string; distanceKm: number | null };
type ItemPayload = {
  place?: { name?: string };
  candidates?: Candidate[];
  agent?: { choice?: string; reason?: string } | null;
  error?: string;
};
type Question = { id: string; kind: ReviewKind; question: string; payload: ItemPayload | null };
type Mention = {
  reviewId: string;
  place: { googlePlaceId: string; name: string; address?: string; neighborhood?: string | null } | null;
  verdict: string | null;
  tags: { slug: string; displayName: string }[];
};
type PostData = {
  post: { id: string; url: string | null; handle: string | null; locationName: string | null; postType: string | null; status: string; lastRunId: string | null };
  mentions: Mention[];
  reviewItems: Question[];
};

const distance = (km: number | null) => (km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/** Every query a post change can touch. */
function refreshAll() {
  for (const key of ["admin-review", "admin-post", "admin-posts", "admin-post-runs", "admin-sources", "place-detail", "feed", "user-profile"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/** The tab over the post: its question, or where it stands. */
function describe(data: PostData | undefined, active: Question | null): { label: string; status: string } {
  if (active) return { label: KIND_LABEL[active.kind], status: active.kind === "failed_run" ? "failed" : "needs_review" };
  if (!data) return { label: "Post", status: "pending" };
  if (data.post.status === "failed") return { label: "Failed", status: "failed" };
  if (data.post.postType === "not_a_place") return { label: "Not a place", status: "pending" };
  const names = data.mentions.map((m) => m.place?.name).filter(Boolean);
  const places = names.length > 2 ? `${names.slice(0, 2).join(", ")} + ${names.length - 2} more` : names.join(", ");
  if (!data.post.lastRunId) return { label: places ? `${places} · not read yet` : "Not read yet", status: "pending" };
  return { label: places || "No places found", status: places ? "completed" : "pending" };
}

export function PostModal({
  postId,
  itemId,
  position,
  open,
  onOpenChange,
  onNext,
}: {
  postId: string | null;
  /** The question to show first (from Review). */
  itemId?: string | null;
  /** Where the post sits in the list it opened from: "· 3 of 31" in its tab. */
  position?: { index: number; total: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The next post in the list this opened from; without it, answering closes. */
  onNext?: () => void;
}) {
  const { data, isLoading } = useQuery<PostData>({
    queryKey: ["admin-post", postId],
    queryFn: () => adminFetch(`/api/admin/posts/${postId}`),
    enabled: open && !!postId,
  });
  const questions = data?.reviewItems ?? [];

  const [tab, setTab] = React.useState("summary");
  const [focusId, setFocusId] = React.useState<string | null>(itemId ?? null);
  React.useEffect(() => {
    setFocusId(itemId ?? null);
    setTab("summary");
  }, [postId, itemId]);
  const active = questions.find((q) => q.id === focusId) ?? questions[0] ?? null;

  const payload = active?.payload ?? {};
  const candidates = payload.candidates ?? [];
  const agentPick = candidates.find((c) => c.id === payload.agent?.choice)?.googlePlaceId;

  // The answer: a candidate's place id, "search" (then `picked`), "none", or "not_a_place".
  const [choice, setChoice] = React.useState("");
  const [picked, setPicked] = React.useState<PickedPlace | null>(null);
  const [confirmingNotAPlace, setConfirmingNotAPlace] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    setChoice(active?.kind === "check_not_a_place" ? "not_a_place" : agentPick ?? "");
    setPicked(null);
    setConfirmingNotAPlace(false);
  }, [active?.id, active?.kind, agentPick]);

  const leave = () => (onNext ? onNext() : onOpenChange(false));
  /** After an answer: the post's next question, or the next post. */
  const answered = (message: string) => {
    toast.success(message);
    refreshAll();
    const rest = questions.filter((q) => q.id !== active?.id);
    if (rest.length) setFocusId(rest[0].id);
    else leave();
  };
  /** After a whole-post action. */
  const finished = (message: string) => {
    toast.success(message);
    refreshAll();
    leave();
  };
  const onError = (err: Error) => toast.error(err.message);

  const itemAction = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminFetch(`/api/admin/review/${active!.id}`, { method: "POST", json: body }),
    onError,
  });
  const postAction = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminFetch(`/api/admin/posts/${postId}`, { method: "POST", json: body }),
    onError,
  });
  const pending = itemAction.isPending || postAction.isPending;

  const save = () => {
    if (!active) return leave();
    const placeId = choice === "search" ? picked?.googlePlaceId : choice;
    if (active.kind === "confirm_place") {
      if (choice === "none") return itemAction.mutate({ action: "dismiss", note: "Not a real place" }, { onSuccess: () => answered("Skipped that name") });
      if (placeId) return itemAction.mutate({ action: "confirm_places", googlePlaceIds: [placeId] }, { onSuccess: () => answered("Place confirmed") });
      return;
    }
    if (active.kind === "check_not_a_place") {
      if (choice === "not_a_place") return postAction.mutate({ action: "not_a_place" }, { onSuccess: () => finished("Marked not a place") });
      if (placeId)
        return postAction.mutate({ action: "save", edits: [{ googlePlaceId: placeId, role: "primary" }], resolveItemIds: [active.id] }, { onSuccess: () => answered("Place added") });
      return;
    }
    if (active.kind === "failed_run") return itemAction.mutate({ action: "rerun" }, { onSuccess: () => finished("Re-run started") });
    // Check places (and anything else): the places on the post are right.
    const edits = (data?.mentions ?? []).map((m) => ({ reviewId: m.reviewId }));
    postAction.mutate({ action: "save", edits, resolveItemIds: [active.id] }, { onSuccess: () => answered("Confirmed") });
  };

  const markNotAPlace = () => {
    if ((data?.mentions.length ?? 0) > 0 && !confirmingNotAPlace) return setConfirmingNotAPlace(true);
    postAction.mutate({ action: "not_a_place" }, { onSuccess: () => finished("Marked not a place") });
  };
  /** Re-run stays on the post and switches to Steps, where the new run shows up. */
  const rerun = () =>
    postAction.mutate(
      { action: "rerun" },
      {
        onSuccess: () => {
          toast.success("Re-run started. It shows up under Steps in a few seconds.");
          setTab("steps");
          const id = data?.post.id;
          setTimeout(() => queryClient.invalidateQueries({ queryKey: ["admin-post-runs", id] }), 2000);
        },
      },
    );

  const canSave =
    !pending &&
    !!data &&
    (!active || (active.kind === "confirm_place" || active.kind === "check_not_a_place" ? choice !== "" && (choice !== "search" || !!picked) : true));
  const next = onNext ? " and next" : "";
  const saveLabel = !active
    ? onNext
      ? "Next"
      : "Done"
    : active.kind === "failed_run"
      ? `Re-run${next}`
      : active.kind === "fix_extraction" || active.kind === "spot_check"
        ? onNext
          ? "Looks right, next"
          : "Looks right"
        : `Save${next}`;

  // Enter saves, unless focus is in a field, on a button or link, or in a menu.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key === "Enter" && canSave && !["INPUT", "TEXTAREA", "BUTTON", "A"].includes(t.tagName) && !t.closest("[role=listbox],[role=menu],[role=tab]")) {
      e.preventDefault();
      save();
    }
  };

  const selectItems: Record<string, React.ReactNode> = {
    ...Object.fromEntries(candidates.map((c) => [c.googlePlaceId, c.name])),
    search: "Search for another place…",
    none: "Not a real place (skip this name)",
    not_a_place: "Right, it's not about a place",
  };
  const tabLabel = describe(data, active);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl md:h-[86dvh] md:flex-row" onKeyDown={onKeyDown} data-testid="dialog-post">
          <DialogTitle className="sr-only">Post</DialogTitle>
          <div className="max-h-[38dvh] shrink-0 overflow-y-auto border-b p-4 md:max-h-none md:w-[380px] md:border-r md:border-b-0" data-testid="post-modal-post">
            {data ? (
              <PostEmbed permalink={data.post.url} author={data.post.handle ?? ""} label={position ? `${tabLabel.label} · ${position.index + 1} of ${position.total}` : tabLabel.label} status={tabLabel.status} />
            ) : (
              <Skeleton className="h-96 w-full" />
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="px-4 pt-4 pr-12">
              <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
                <TabsList data-testid="tabs-post">
                  <TabsTrigger value="summary" data-testid="tab-post-summary">
                    Summary
                  </TabsTrigger>
                  <TabsTrigger value="steps" data-testid="tab-post-steps">
                    Steps
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {!data || isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : tab === "steps" ? (
                <RunSteps postId={data.post.id} onReadNow={rerun} reading={postAction.isPending} />
              ) : (
                <div className="space-y-5">
                  {active && (
                    <div className="space-y-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30" data-testid="post-question">
                      {active.kind === "confirm_place" ? (
                        <>
                          <p className="text-sm font-medium">Which place is &ldquo;{payload.place?.name ?? "this"}&rdquo;?</p>
                          {payload.agent?.reason && <p className="text-xs text-muted-foreground">{payload.agent.reason}</p>}
                          <Select items={selectItems} value={choice || null} onValueChange={(v) => setChoice((v as string | null) ?? "")}>
                            <SelectTrigger className="w-full bg-background" data-testid="select-review-place">
                              <SelectValue placeholder="Choose the place" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {candidates.map((c) => (
                                  <SelectItem key={c.googlePlaceId} value={c.googlePlaceId} data-testid={`option-candidate-${c.googlePlaceId}`}>
                                    <span className="flex min-w-0 flex-col">
                                      <span className="truncate">
                                        {c.name}
                                        {c.googlePlaceId === agentPick && <span className="text-muted-foreground"> · the engine&apos;s pick</span>}
                                      </span>
                                      <span className="truncate text-xs text-muted-foreground">{[c.address, distance(c.distanceKm)].filter(Boolean).join(" · ")}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                              {candidates.length > 0 && <SelectSeparator />}
                              <SelectItem value="search" data-testid="option-search-place">
                                Search for another place…
                              </SelectItem>
                              <SelectItem value="none" data-testid="option-not-real-place">
                                Not a real place (skip this name)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      ) : active.kind === "check_not_a_place" ? (
                        <>
                          <p className="text-sm font-medium">
                            The engine thinks this post isn&apos;t about a place{data.post.locationName ? `, but it's tagged at "${data.post.locationName}"` : ""}. Is that right?
                          </p>
                          <Select items={selectItems} value={choice || null} onValueChange={(v) => setChoice((v as string | null) ?? "")}>
                            <SelectTrigger className="w-full bg-background" data-testid="select-review-not-a-place">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_a_place">Right, it&apos;s not about a place</SelectItem>
                              <SelectItem value="search">It&apos;s about a place: search for it…</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      ) : active.kind === "failed_run" ? (
                        <>
                          <p className="text-sm font-medium">The engine couldn&apos;t finish this post, even after retries.</p>
                          {payload.error && <p className="line-clamp-3 text-xs text-muted-foreground">{payload.error}</p>}
                        </>
                      ) : (
                        <p className="text-sm font-medium">The engine wasn&apos;t sure it read this post&apos;s places right. Are the places below right?</p>
                      )}

                      {choice === "search" &&
                        (picked ? (
                          <div className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{picked.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{picked.address}</span>
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                              Change
                            </Button>
                          </div>
                        ) : (
                          <PlaceSearch inline autoFocus initialQuery={payload.place?.name ?? ""} testId="review-search" onPick={setPicked} />
                        ))}

                      {questions.length > 1 && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-amber-200/70 pt-2 text-xs text-muted-foreground dark:border-amber-900">
                          <span>{questions.length - 1} more on this post:</span>
                          {questions
                            .filter((q) => q.id !== active.id)
                            .map((q) => (
                              <button key={q.id} type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => setFocusId(q.id)}>
                                {q.question}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  <section className="space-y-2" data-testid="post-places">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {data.post.postType === "not_a_place" ? "Not about a place" : data.mentions.length === 0 ? "No places yet" : data.mentions.length === 1 ? "1 place" : `${data.mentions.length} places`}
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(true)} data-testid="button-post-edit-places">
                        Edit places
                      </Button>
                    </div>
                    {data.mentions.length > 0 && (
                      <ul className="divide-y rounded-lg border">
                        {data.mentions.map((m) => (
                          <li key={m.reviewId} className="px-3 py-2">
                            {m.place ? (
                              <Link href={`/places/${m.place.googlePlaceId}`} className="block truncate text-sm font-medium hover:underline">
                                {m.place.name}
                              </Link>
                            ) : (
                              <p className="text-sm font-medium">Unknown place</p>
                            )}
                            <p className="truncate text-xs text-muted-foreground">
                              {[m.place?.neighborhood ?? m.place?.address, m.verdict && m.verdict !== "none" ? m.verdict : null, m.tags.slice(0, 4).map((t) => t.displayName).join(", ") || null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>

            <div className="flex items-center gap-0.5 border-t px-4 py-3">
              <IconAction
                label={confirmingNotAPlace ? "Click again: removes every place on this post" : "The whole post isn't about a place"}
                icon={PinOffIcon}
                onClick={markNotAPlace}
                disabled={pending || !data}
                danger={confirmingNotAPlace}
                testId="button-post-not-a-place"
              />
              <IconAction label="Run the engine on this post again" icon={RefreshIcon} onClick={rerun} disabled={pending || !data} testId="button-post-rerun" />
              {onNext && <IconAction label="Skip for now" icon={NextIcon} onClick={onNext} disabled={pending} testId="button-post-skip" />}
              <span className="flex-1" />
              <Button onClick={save} disabled={!canSave} data-testid="button-post-save">
                {pending ? "Saving..." : saveLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {editing && (
        <MentionEditor
          postId={postId}
          reviewItemId={active?.id ?? null}
          open={editing}
          onOpenChange={setEditing}
          onDone={() => {
            setEditing(false);
            toast.success("Saved");
            refreshAll();
          }}
        />
      )}
    </>
  );
}

/** The pencil on a post (Edit mode): opens the post window. */
export function PostEditButton({ postId, className }: { postId: string; className?: string }) {
  const { enabled } = useAdminMode();
  const [open, setOpen] = React.useState(false);
  // Mounted from the first open on, so closing can animate.
  const [mounted, setMounted] = React.useState(false);
  if (!enabled) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit post"
        className={cn(className)}
        onClick={(e) => {
          e.stopPropagation();
          setMounted(true);
          setOpen(true);
        }}
        data-testid={`button-edit-post-${postId}`}
      >
        <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
      </Button>
      {mounted && <PostModal postId={postId} open={open} onOpenChange={setOpen} />}
    </>
  );
}
