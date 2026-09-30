"use client";

/**
 * One review item at a time: the post itself (Instagram's embed) under a tab
 * saying what it needs, one question with one answer control, "Save and
 * next", and four quiet icon actions for the whole post (not a place,
 * re-run, edit every place, skip).
 */

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { NextIcon, PencilEdit01Icon, PinOffIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/components/admin/admin-fetch";
import { IconAction } from "@/components/admin/icon-action";
import { MentionEditor } from "@/components/admin/mention-editor";
import { PlaceSearch, type PickedPlace } from "@/components/admin/place-search";
import { PostEmbed } from "@/components/admin/post-embed";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

export type ReviewKind = "confirm_place" | "check_not_a_place" | "fix_extraction" | "failed_run" | "spot_check" | "confirm_example";

export type ReviewListItem = { id: string; kind: ReviewKind; question: string; postId: string | null };

type Candidate = { id: string; googlePlaceId: string; name: string; address: string; distanceKm: number | null };
type ItemPayload = {
  place?: { name?: string };
  candidates?: Candidate[];
  agent?: { choice?: string; reason?: string } | null;
  locationName?: string | null;
  error?: string;
};
type PostData = {
  post: { id: string; url: string | null; handle: string | null; locationName: string | null };
  mentions: { reviewId: string; place: { name: string } | null }[];
  reviewItems: { id: string; kind: ReviewKind; question: string; payload: ItemPayload | null }[];
};

export const KIND_LABEL: Record<ReviewKind, string> = {
  confirm_place: "Confirm place",
  check_not_a_place: "Not a place?",
  fix_extraction: "Check places",
  failed_run: "Failed",
  spot_check: "Spot check",
  confirm_example: "Confirm example",
};

const distance = (km: number | null) => (km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

export function ReviewDialog({
  item,
  position,
  open,
  onOpenChange,
  onNext,
}: {
  item: ReviewListItem | null;
  /** "3 of 31" in the tab. */
  position: { index: number; total: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Go to the next item (after an answer, or on skip). */
  onNext: () => void;
}) {
  const postId = item?.postId ?? null;
  const { data, isLoading } = useQuery<PostData>({
    queryKey: ["admin-post", postId],
    queryFn: () => adminFetch(`/api/admin/posts/${postId}`),
    enabled: open && !!postId,
  });
  const full = data?.reviewItems.find((i) => i.id === item?.id) ?? null;
  const payload = full?.payload ?? {};
  const candidates = payload.candidates ?? [];
  const agentPick = candidates.find((c) => c.id === payload.agent?.choice)?.googlePlaceId;

  // The answer: a candidate's place id, "search" (then `picked`), "none", or "not_a_place".
  const [choice, setChoice] = React.useState("");
  const [picked, setPicked] = React.useState<PickedPlace | null>(null);
  const [confirmingNotAPlace, setConfirmingNotAPlace] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    setChoice(item?.kind === "check_not_a_place" ? "not_a_place" : agentPick ?? "");
    setPicked(null);
    setConfirmingNotAPlace(false);
  }, [item?.id, item?.kind, agentPick]);

  const done = (message: string) => {
    toast.success(message);
    for (const key of ["admin-review", "admin-post", "admin-source", "admin-sources", "place-detail", "feed", "user-profile"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
    onNext();
  };
  const onError = (err: Error) => toast.error(err.message);

  const itemAction = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminFetch(`/api/admin/review/${item!.id}`, { method: "POST", json: body }),
    onError,
  });
  const postAction = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminFetch(`/api/admin/posts/${postId}`, { method: "POST", json: body }),
    onError,
  });
  const pending = itemAction.isPending || postAction.isPending;

  const save = () => {
    if (!item) return;
    const placeId = choice === "search" ? picked?.googlePlaceId : choice;
    if (item.kind === "confirm_place") {
      if (choice === "none") return itemAction.mutate({ action: "dismiss", note: "Not a real place" }, { onSuccess: () => done("Skipped that name") });
      if (placeId) return itemAction.mutate({ action: "confirm_places", googlePlaceIds: [placeId] }, { onSuccess: () => done("Place confirmed") });
      return;
    }
    if (item.kind === "check_not_a_place") {
      if (choice === "not_a_place") return postAction.mutate({ action: "not_a_place" }, { onSuccess: () => done("Marked not a place") });
      if (placeId)
        return postAction.mutate(
          { action: "save", edits: [{ googlePlaceId: placeId, role: "primary" }], resolveItemIds: [item.id] },
          { onSuccess: () => done("Place added") },
        );
      return;
    }
    if (item.kind === "failed_run") return itemAction.mutate({ action: "rerun" }, { onSuccess: () => done("Re-run queued") });
    // Check places (and anything else): the places on the post are right.
    const edits = (data?.mentions ?? []).map((m) => ({ reviewId: m.reviewId }));
    postAction.mutate({ action: "save", edits, resolveItemIds: [item.id] }, { onSuccess: () => done("Confirmed") });
  };

  const markNotAPlace = () => {
    if ((data?.mentions.length ?? 0) > 0 && !confirmingNotAPlace) return setConfirmingNotAPlace(true);
    postAction.mutate({ action: "not_a_place" }, { onSuccess: () => done("Marked not a place") });
  };
  const rerun = () => postAction.mutate({ action: "rerun" }, { onSuccess: () => done("Re-run queued") });

  const canSave =
    !!item &&
    !pending &&
    !!data &&
    (item.kind === "confirm_place" || item.kind === "check_not_a_place"
      ? choice !== "" && (choice !== "search" || !!picked)
      : true);
  const saveLabel = item?.kind === "failed_run" ? "Re-run and next" : item?.kind === "fix_extraction" || item?.kind === "spot_check" ? "Looks right, next" : "Save and next";

  // Enter saves (outside the search box and the open dropdown).
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key === "Enter" && canSave && !["INPUT", "TEXTAREA"].includes(t.tagName) && !t.closest("[role=listbox]")) {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-[480px]" onKeyDown={onKeyDown} data-testid="dialog-review">
          <DialogTitle className="sr-only">Review</DialogTitle>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
            {item && (
              <PostEmbed
                permalink={data?.post.url ?? null}
                author={data?.post.handle ?? ""}
                label={`${KIND_LABEL[item.kind]} · ${position.index + 1} of ${position.total}`}
                status={item.kind === "failed_run" ? "failed" : "needs_review"}
              />
            )}
          </div>

          <div className="space-y-3 border-t px-4 py-4">
            {!data || isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : item?.kind === "confirm_place" ? (
              <>
                <p className="text-sm font-medium">Which place is &ldquo;{payload.place?.name ?? "this"}&rdquo;?</p>
                <Select items={selectItems} value={choice || null} onValueChange={(v) => setChoice((v as string | null) ?? "")}>
                  <SelectTrigger className="w-full" data-testid="select-review-place">
                    <SelectValue placeholder="Choose the place" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {candidates.map((c) => (
                        <SelectItem key={c.googlePlaceId} value={c.googlePlaceId} data-testid={`option-candidate-${c.googlePlaceId}`}>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">
                              {c.name}
                              {c.googlePlaceId === agentPick && <span className="text-muted-foreground"> · agent&apos;s pick</span>}
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
            ) : item?.kind === "check_not_a_place" ? (
              <>
                <p className="text-sm font-medium">
                  Read says this post isn&apos;t about a place{data.post.locationName ? `, but it's tagged at "${data.post.locationName}"` : ""}. Is that right?
                </p>
                <Select items={selectItems} value={choice || null} onValueChange={(v) => setChoice((v as string | null) ?? "")}>
                  <SelectTrigger className="w-full" data-testid="select-review-not-a-place">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_a_place">Right, it&apos;s not about a place</SelectItem>
                    <SelectItem value="search">It&apos;s about a place: search for it…</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : item?.kind === "failed_run" ? (
              <>
                <p className="text-sm font-medium">The engine failed on this post, even after retries.</p>
                {payload.error && <p className="line-clamp-3 text-xs text-muted-foreground">{payload.error}</p>}
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Read broke one of its rules on this post. Are these its places?</p>
                <div className="flex flex-wrap gap-1.5">
                  {(data.mentions ?? []).length === 0 ? (
                    <span className="text-sm text-muted-foreground">No places</span>
                  ) : (
                    data.mentions.map((m) => (
                      <Badge key={m.reviewId} variant="secondary" className="font-normal">
                        {m.place?.name ?? "Unknown place"}
                      </Badge>
                    ))
                  )}
                </div>
              </>
            )}

            {choice === "search" && (
              <div className="space-y-1.5">
                {picked ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
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
                )}
              </div>
            )}

            <div className="flex items-center gap-0.5 pt-1">
              <IconAction
                label={confirmingNotAPlace ? "Click again: removes every place on this post" : "The whole post isn't about a place"}
                icon={PinOffIcon}
                onClick={markNotAPlace}
                disabled={pending || !data}
                danger={confirmingNotAPlace}
                testId="button-review-not-a-place"
              />
              <IconAction label="Run the engine on this post again" icon={RefreshIcon} onClick={rerun} disabled={pending || !data} testId="button-review-rerun" />
              <IconAction label="Edit every place on this post" icon={PencilEdit01Icon} onClick={() => setEditing(true)} disabled={!data} testId="button-review-edit" />
              <IconAction label="Skip for now" icon={NextIcon} onClick={onNext} disabled={pending} testId="button-review-skip" />
              <span className="flex-1" />
              <Button onClick={save} disabled={!canSave} data-testid="button-review-save">
                {pending ? "Saving..." : saveLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {editing && (
        <MentionEditor
          postId={postId}
          reviewItemId={item?.id ?? null}
          open={editing}
          onOpenChange={setEditing}
          onDone={() => {
            setEditing(false);
            done("Saved");
          }}
        />
      )}
    </>
  );
}
