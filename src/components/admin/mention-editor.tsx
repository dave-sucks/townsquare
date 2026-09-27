"use client";

/**
 * The mention editor: one post and every place it mentions. A Dialog
 * (sm:max-w-lg) on desktop, a Drawer on mobile. Top: the post (media and
 * caption, each mention's excerpt highlighted) and its open review items,
 * such as a place to pick among candidates. Below: one PlaceRowCard per
 * mention with its excerpt, verdict, role, dishes and tags, plus Change place
 * and Remove. Footer: Add place, Not a place, Re-run, and Save (or Confirm,
 * when nothing changed: the reading was right).
 *
 * Pickers render in the flow rather than in popovers, so they work inside the
 * Drawer, which sits above popovers. Every save goes through
 * /api/admin/posts/[id], which audits it and saves Examples.
 */

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Location01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PlaceRowCard } from "@/components/chat/place-row-card";
import { FallbackImg } from "@/components/chat/trace-items";
import { StatusDot } from "@/components/shared/status-dot";
import { useAdminMode } from "@/components/admin/admin-mode";
import { PlaceSearch, type PickedPlace } from "@/components/admin/place-search";
import { EditableTagChips, type ChipTag } from "@/components/admin/tag-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import { queryClient } from "@/lib/query-client";
import { adminFetch } from "@/components/admin/admin-fetch";
import type { PlaceRow } from "@/lib/agent/place-row";
import { cn } from "@/lib/utils";

type Verdict = "loved" | "liked" | "mixed" | "disliked" | "none";
type Role = "primary" | "list_item" | "passing";
type Sentiment = "positive" | "neutral" | "negative";
type Dish = { name: string; sentiment: Sentiment };

type MentionData = {
  reviewId: string;
  place: PlaceRow | null;
  excerpt: string | null;
  verdict: Verdict | null;
  dishes: Dish[];
  role: Role;
  status: string;
  resolvedBy: string | null;
  confidence: number | null;
  score: string | null;
  tags: { slug: string; displayName: string; source: string }[];
};

type ReadPlace = { name?: string; excerpt?: string; verdict?: Verdict; dishes?: Dish[]; role?: Role };
type Candidate = { id: string; googlePlaceId: string; name: string; address: string; distanceKm: number | null };
type ReviewItemData = {
  id: string;
  kind: "confirm_place" | "check_not_a_place" | "fix_extraction" | "failed_run" | "spot_check" | "confirm_example";
  question: string;
  payload: { place?: ReadPlace; candidates?: Candidate[]; agent?: { choice?: string } | null } | null;
  createdAt: string;
};

type EditorData = {
  post: {
    id: string;
    shortcode: string;
    url: string | null;
    caption: string | null;
    postedAt: string | null;
    postType: string | null;
    status: string;
    mediaUrl: string | null;
    handle: string | null;
    lastRunId: string | null;
  };
  mentions: MentionData[];
  reviewItems: ReviewItemData[];
};

/** One mention as the editor holds it until Save. */
type Draft = {
  key: string;
  reviewId?: string;
  place: PlaceRow | null;
  /** A place picked here (new, or replacing the mention's place). */
  picked?: PickedPlace;
  excerpt: string;
  verdict: Verdict | null;
  dishes: Dish[];
  tags: ChipTag[];
  role: Role;
  removed: boolean;
};

type MentionEdit = {
  reviewId?: string;
  googlePlaceId?: string;
  excerpt?: string | null;
  verdict?: Verdict | null;
  dishes?: Dish[];
  tagSlugs?: string[];
  role?: Role;
  remove?: boolean;
};

const KIND_LABEL: Record<ReviewItemData["kind"], string> = {
  confirm_place: "Confirm place",
  check_not_a_place: "Not a place?",
  fix_extraction: "Fix extraction",
  failed_run: "Failed run",
  spot_check: "Spot check",
  confirm_example: "Confirm example",
};

const VERDICTS: { value: Verdict; label: string }[] = [
  { value: "loved", label: "Loved" },
  { value: "liked", label: "Liked" },
  { value: "mixed", label: "Mixed" },
  { value: "disliked", label: "Disliked" },
  { value: "none", label: "No verdict" },
];

const ROLES: { value: Role; label: string }[] = [
  { value: "primary", label: "Main place" },
  { value: "list_item", label: "List item" },
  { value: "passing", label: "In passing" },
];

const NEXT_SENTIMENT: Record<Sentiment, Sentiment> = { positive: "neutral", neutral: "negative", negative: "positive" };

function toDraft(m: MentionData): Draft {
  return {
    key: m.reviewId,
    reviewId: m.reviewId,
    place: m.place,
    excerpt: m.excerpt ?? "",
    verdict: m.verdict,
    dishes: m.dishes,
    tags: m.tags.map((t) => ({ slug: t.slug, displayName: t.displayName, source: t.source })),
    role: m.role,
    removed: false,
  };
}

const sameList = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** The edits Save sends: changed fields only; an untouched mention is sent bare, which confirms it. */
function editsFor(drafts: Draft[], original: MentionData[]): { edits: MentionEdit[]; changed: number } {
  const byId = new Map(original.map((m) => [m.reviewId, m]));
  const edits: MentionEdit[] = [];
  let changed = 0;
  for (const d of drafts) {
    const before = d.reviewId ? byId.get(d.reviewId) : undefined;
    if (!before) {
      if (d.removed || !d.picked) continue;
      changed++;
      edits.push({
        googlePlaceId: d.picked.googlePlaceId,
        excerpt: d.excerpt.trim() || null,
        verdict: d.verdict,
        dishes: d.dishes,
        tagSlugs: d.tags.map((t) => t.slug),
        role: d.role,
      });
      continue;
    }
    if (d.removed) {
      changed++;
      edits.push({ reviewId: before.reviewId, remove: true });
      continue;
    }
    const e: MentionEdit = { reviewId: before.reviewId };
    if (d.picked && d.picked.googlePlaceId !== before.place?.googlePlaceId) e.googlePlaceId = d.picked.googlePlaceId;
    if (d.excerpt.trim() !== (before.excerpt ?? "").trim()) e.excerpt = d.excerpt.trim() || null;
    if (d.verdict !== before.verdict) e.verdict = d.verdict;
    if (d.role !== before.role) e.role = d.role;
    if (JSON.stringify(d.dishes) !== JSON.stringify(before.dishes)) e.dishes = d.dishes;
    if (!sameList(d.tags.map((t) => t.slug), before.tags.map((t) => t.slug))) e.tagSlugs = d.tags.map((t) => t.slug);
    if (Object.keys(e).length > 1) changed++;
    edits.push(e);
  }
  return { edits, changed };
}

/** Everything the editor's writes can change on screen. */
function invalidateAfterWrite(postId: string) {
  for (const key of ["admin-post", "place-detail", "feed", "user-profile", "admin-review", "admin-sources", "admin-source", "admin-runs"]) {
    queryClient.invalidateQueries({ queryKey: key === "admin-post" ? [key, postId] : [key] });
  }
}

/** The caption with each mention's excerpt marked. */
function HighlightedCaption({ caption, excerpts }: { caption: string; excerpts: string[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const ranges: [number, number][] = [];
  const lower = caption.toLowerCase();
  for (const ex of excerpts) {
    const needle = ex.trim().toLowerCase();
    if (needle.length < 4) continue;
    let at = lower.indexOf(needle);
    let len = needle.length;
    if (at < 0) {
      // Excerpts are verbatim but may join lines; fall back to their first words.
      const head = needle.slice(0, 40);
      at = lower.indexOf(head);
      len = head.length;
    }
    if (at >= 0) ranges.push([at, at + len]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    if (start > cursor) parts.push(caption.slice(cursor, start));
    parts.push(
      <mark key={start} className="rounded-sm bg-amber-500/20 text-foreground">
        {caption.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  parts.push(caption.slice(cursor));

  return (
    <div>
      <p className={cn("text-sm text-muted-foreground whitespace-pre-line", !expanded && "line-clamp-6")} data-testid="text-editor-caption">
        {parts}
      </p>
      {caption.length > 280 && (
        <Button variant="link" size="xs" className="h-auto px-0 text-foreground" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Less" : "More"}
        </Button>
      )}
    </div>
  );
}

/** A place picked in the editor, laid out like PlaceRowCard's header. */
function PickedPlaceRow({ place, label }: { place: PickedPlace; label: string }) {
  return (
    <div className="flex gap-3 p-2">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
        <HugeiconsIcon icon={Location01Icon} className="size-5 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate font-brand text-[15px] leading-tight font-semibold">{place.name}</p>
          <Badge variant="secondary" className="font-normal shrink-0">
            {label}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">{place.address}</p>
      </div>
    </div>
  );
}

function DishChips({ dishes, onChange, testId }: { dishes: Dish[]; onChange: (dishes: Dish[]) => void; testId: string }) {
  const [value, setValue] = React.useState("");
  const add = () => {
    const name = value.trim();
    if (!name || dishes.some((d) => d.name.toLowerCase() === name.toLowerCase())) return setValue("");
    onChange([...dishes, { name, sentiment: "positive" }]);
    setValue("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
      {dishes.map((d, i) => (
        <Badge
          key={d.name}
          variant={d.sentiment === "negative" ? "outline" : "secondary"}
          className={cn("group/chip font-normal gap-1 pr-1", d.sentiment !== "positive" && "text-muted-foreground")}
        >
          <button
            type="button"
            title={`${d.sentiment} · click to change`}
            onClick={() => onChange(dishes.map((x, j) => (j === i ? { ...x, sentiment: NEXT_SENTIMENT[x.sentiment] } : x)))}
            data-testid={`button-sentiment-${testId}-${i}`}
          >
            {d.sentiment === "negative" ? "− " : d.sentiment === "neutral" ? "~ " : ""}
            {d.name}
          </button>
          <button
            type="button"
            aria-label={`Remove ${d.name}`}
            onClick={() => onChange(dishes.filter((_, j) => j !== i))}
            className="opacity-40 transition-opacity group-hover/chip:opacity-100 hover:text-destructive"
            data-testid={`button-remove-${testId}-${i}`}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="Add a dish"
        className="h-6 w-28 rounded-full px-2.5 text-xs"
        data-testid={`input-${testId}`}
      />
    </div>
  );
}

function MentionCard({
  draft,
  index,
  onChange,
}: {
  draft: Draft;
  index: number;
  onChange: (next: Partial<Draft>) => void;
}) {
  const [changing, setChanging] = React.useState(false);
  const testId = `mention-${index}`;
  const name = draft.picked?.name ?? draft.place?.name ?? "Unknown place";

  if (draft.removed) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground" data-testid={`${testId}-removed`}>
        <span className="min-w-0 truncate">{name} will be removed</span>
        <Button variant="link" size="xs" className="h-auto px-0 text-foreground" onClick={() => onChange({ removed: false })} data-testid={`button-undo-remove-${testId}`}>
          Undo
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border" data-testid={testId}>
      {draft.picked ? (
        <PickedPlaceRow place={draft.picked} label={draft.reviewId ? "Changed" : "New"} />
      ) : draft.place ? (
        <PlaceRowCard place={{ ...draft.place, tags: [], latestPost: undefined }} selected={false} onSelect={() => {}} hidePost />
      ) : (
        <p className="p-3 text-sm text-muted-foreground">Unknown place</p>
      )}
      <div className="space-y-3 px-3 pb-3 pt-1">
        {changing && (
          <PlaceSearch
            inline
            autoFocus
            placeholder="Search for the right place..."
            testId={`${testId}-change`}
            onPick={(p) => {
              onChange({ picked: p });
              setChanging(false);
            }}
          />
        )}
        <Textarea
          value={draft.excerpt}
          onChange={(e) => onChange({ excerpt: e.target.value })}
          placeholder="What the post says about this place"
          className="min-h-16 text-sm"
          style={{ fontSize: "16px" }}
          data-testid={`input-${testId}-excerpt`}
        />
        <div className="flex gap-2">
          <NativeSelect
            size="sm"
            value={draft.verdict ?? ""}
            onChange={(e) => onChange({ verdict: (e.target.value || null) as Verdict | null })}
            aria-label="Verdict"
            data-testid={`select-${testId}-verdict`}
          >
            <NativeSelectOption value="">Verdict not set</NativeSelectOption>
            {VERDICTS.map((v) => (
              <NativeSelectOption key={v.value} value={v.value}>
                {v.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            size="sm"
            value={draft.role}
            onChange={(e) => onChange({ role: e.target.value as Role })}
            aria-label="Role in the post"
            data-testid={`select-${testId}-role`}
          >
            {ROLES.map((r) => (
              <NativeSelectOption key={r.value} value={r.value}>
                {r.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Dishes</p>
          <DishChips dishes={draft.dishes} onChange={(dishes) => onChange({ dishes })} testId={`${testId}-dishes`} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Tags</p>
          <EditableTagChips
            inline
            tags={draft.tags}
            onRemove={(slug) => onChange({ tags: draft.tags.filter((t) => t.slug !== slug) })}
            onAdd={(slug, displayName) => onChange({ tags: [...draft.tags, { slug, displayName }] })}
            testId={`${testId}-tags`}
          />
        </div>
        <div className="flex items-center gap-1 -mx-2">
          <Button variant="ghost" size="sm" onClick={() => setChanging((c) => !c)} data-testid={`button-change-place-${testId}`}>
            {changing ? "Cancel" : "Change place"}
          </Button>
          {draft.picked && draft.reviewId && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ picked: undefined })} data-testid={`button-undo-change-${testId}`}>
              Undo change
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => onChange({ removed: true })}
            data-testid={`button-remove-${testId}`}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewItemCard({
  item,
  pending,
  onConfirm,
  onNoneOfThese,
  onNotAPlace,
  onAddPlace,
  onDismiss,
  onRerun,
}: {
  item: ReviewItemData;
  pending: boolean;
  onConfirm: (googlePlaceId: string) => void;
  onNoneOfThese: () => void;
  onNotAPlace: () => void;
  onAddPlace: () => void;
  onDismiss: () => void;
  onRerun: () => void;
}) {
  const candidates = item.payload?.candidates ?? [];
  const agentPick = item.payload?.agent?.choice;
  return (
    <div className="rounded-xl border p-3 space-y-2" data-testid={`review-item-${item.id}`}>
      <div className="flex items-center gap-2">
        <StatusDot status={item.kind === "failed_run" ? "failed" : "needs_review"} />
        <p className="text-xs font-medium text-muted-foreground">{KIND_LABEL[item.kind]}</p>
      </div>
      <p className="text-sm font-medium">{item.question}</p>
      {item.kind === "confirm_place" && candidates.length > 0 && (
        <div className="-mx-2">
          {candidates.slice(0, 5).map((c) => (
            <button
              key={c.googlePlaceId}
              type="button"
              disabled={pending}
              onClick={() => onConfirm(c.googlePlaceId)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50"
              data-testid={`button-candidate-${c.googlePlaceId}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.address}
                  {c.distanceKm != null ? ` · ${c.distanceKm < 1 ? `${Math.round(c.distanceKm * 1000)} m` : `${c.distanceKm.toFixed(1)} km`}` : ""}
                </p>
              </div>
              {c.id === agentPick && (
                <Badge variant="secondary" className="font-normal shrink-0">
                  Agent&apos;s pick
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1 -mx-2">
        {item.kind === "confirm_place" && (
          <Button variant="ghost" size="sm" onClick={onNoneOfThese} disabled={pending} data-testid={`button-none-of-these-${item.id}`}>
            None of these
          </Button>
        )}
        {item.kind === "check_not_a_place" && (
          <>
            <Button variant="ghost" size="sm" onClick={onNotAPlace} disabled={pending} data-testid={`button-confirm-not-a-place-${item.id}`}>
              Not a place
            </Button>
            <Button variant="ghost" size="sm" onClick={onAddPlace} disabled={pending} data-testid={`button-add-place-${item.id}`}>
              Add place
            </Button>
          </>
        )}
        {item.kind === "failed_run" && (
          <Button variant="ghost" size="sm" onClick={onRerun} disabled={pending} data-testid={`button-rerun-item-${item.id}`}>
            Re-run
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onDismiss} disabled={pending} data-testid={`button-dismiss-${item.id}`}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function MentionEditor({
  postId,
  open,
  onOpenChange,
  reviewItemId,
  onDone,
}: {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The review item the editor was opened for (the Review queue). */
  reviewItemId?: string | null;
  /** Called after the post is saved or its item resolved (the queue moves on). */
  onDone?: () => void;
}) {
  const isMobile = useIsMobile();
  const { data, isLoading, error } = useQuery<EditorData>({
    queryKey: ["admin-post", postId],
    queryFn: () => adminFetch(`/api/admin/posts/${postId}`),
    enabled: open && !!postId,
  });
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [note, setNote] = React.useState("");
  const [adding, setAdding] = React.useState<null | { forItem?: ReviewItemData }>(null);
  const [confirmNotAPlace, setConfirmNotAPlace] = React.useState(false);
  const newKey = React.useRef(0);

  React.useEffect(() => {
    if (!data) return;
    setDrafts(data.mentions.map(toDraft));
    setAdding(null);
    setConfirmNotAPlace(false);
  }, [data]);
  React.useEffect(() => {
    if (open) setNote("");
  }, [open, postId]);

  const post = data?.post;
  const { edits, changed } = React.useMemo(() => editsFor(drafts, data?.mentions ?? []), [drafts, data]);

  const postAction = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminFetch<{ ok: boolean }>(`/api/admin/posts/${post!.id}`, { method: "POST", json: body }),
    onError: (err: Error) => toast.error(err.message || "Couldn't save"),
  });
  const itemAction = useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: Record<string, unknown> }) =>
      adminFetch<{ ok: boolean }>(`/api/admin/review/${itemId}`, { method: "POST", json: body }),
    onError: (err: Error) => toast.error(err.message || "Couldn't save"),
  });
  const pending = postAction.isPending || itemAction.isPending;

  /** After a write that ends the editing: the Review queue moves on, anywhere else the editor closes. */
  const finish = (message: string) => {
    toast.success(message);
    invalidateAfterWrite(postId!);
    if (onDone) onDone();
    else onOpenChange(false);
  };

  const save = () => {
    const openItems = (data?.reviewItems ?? []).filter((i) => ["fix_extraction", "check_not_a_place", "spot_check"].includes(i.kind)).map((i) => i.id);
    const ids = [...new Set([...openItems, ...(reviewItemId ? [reviewItemId] : [])])];
    postAction.mutate(
      { action: "save", edits, note: note.trim() || null, resolveItemIds: ids },
      { onSuccess: () => finish(changed ? `Saved ${changed} change${changed === 1 ? "" : "s"}` : "Confirmed") },
    );
  };

  /** Two clicks when it removes places; one when there are none. */
  const markNotAPlace = (confirmed = false) => {
    const removes = drafts.some((d) => d.reviewId && !d.removed);
    if (removes && !confirmed && !confirmNotAPlace) return setConfirmNotAPlace(true);
    postAction.mutate(
      { action: "not_a_place", note: note.trim() || null },
      { onSuccess: () => finish("Marked not a place") },
    );
  };

  const rerun = () =>
    postAction.mutate(
      { action: "rerun", note: note.trim() || null },
      { onSuccess: () => finish("Re-run queued. The post updates in a minute or so.") },
    );

  // Confirming reloads the post (the new mention appears), which would drop unsaved edits.
  const confirmCandidate = (item: ReviewItemData, googlePlaceId: string) => {
    if (changed > 0) {
      toast.error("Save your edits first");
      return;
    }
    itemAction.mutate(
      { itemId: item.id, body: { action: "confirm_places", googlePlaceIds: [googlePlaceId], note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success("Place confirmed");
          invalidateAfterWrite(postId!);
          if (item.id === reviewItemId) onDone?.();
        },
      },
    );
  };

  const dismissItem = (item: ReviewItemData, rerunIt = false) =>
    itemAction.mutate(
      { itemId: item.id, body: { action: rerunIt ? "rerun" : "dismiss", note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success(rerunIt ? "Re-run queued" : "Dismissed");
          invalidateAfterWrite(postId!);
          if (item.id === reviewItemId) onDone?.();
        },
      },
    );

  const addPlace = (p: PickedPlace) => {
    // "None of these": the pick answers the review item, as a candidate would.
    if (adding?.forItem) {
      confirmCandidate(adding.forItem, p.googlePlaceId);
      setAdding(null);
      return;
    }
    if (drafts.some((d) => !d.removed && (d.picked?.googlePlaceId ?? d.place?.googlePlaceId) === p.googlePlaceId)) {
      toast.error("That place is already on this post");
      return;
    }
    newKey.current += 1;
    setDrafts((ds) => [
      ...ds,
      {
        key: `new-${newKey.current}`,
        place: null,
        picked: p,
        excerpt: "",
        verdict: null,
        dishes: [],
        tags: [],
        role: ds.filter((d) => !d.removed).length === 0 ? "primary" : "list_item",
        removed: false,
      },
    ]);
    setAdding(null);
  };

  const update = (key: string, next: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...next } : d)));
  const openItems = data?.reviewItems ?? [];
  const excerpts = drafts.filter((d) => !d.removed).map((d) => d.excerpt).filter(Boolean);
  const liveCount = drafts.filter((d) => !d.removed).length;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="mention-editor">
      <div className="px-4 pt-4 pb-3 border-b">
        <p className="text-base leading-none font-medium">Edit post</p>
        {post && (
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <StatusDot status={post.status} />
            <span className="truncate">
              @{post.handle}
              {post.postedAt ? ` · ${formatDistanceToNowStrict(new Date(post.postedAt), { addSuffix: true })}` : ""}
            </span>
            {post.url && (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium text-foreground hover:underline">
                View post ↗
              </a>
            )}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading || !data ? (
          error ? (
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )
        ) : (
          <>
            <div className="flex gap-3">
              {post?.mediaUrl && (
                <FallbackImg src={post.mediaUrl} referrerPolicy="no-referrer" className="size-16 shrink-0 rounded-md object-cover" fallback={null} />
              )}
              <div className="min-w-0 flex-1">
                {post?.caption ? <HighlightedCaption caption={post.caption} excerpts={excerpts} /> : <p className="text-sm text-muted-foreground">No caption.</p>}
              </div>
            </div>

            {openItems.map((item) => (
              <ReviewItemCard
                key={item.id}
                item={item}
                pending={pending}
                onConfirm={(g) => confirmCandidate(item, g)}
                onNoneOfThese={() => setAdding({ forItem: item })}
                onNotAPlace={() => markNotAPlace()}
                onAddPlace={() => setAdding({})}
                onDismiss={() => dismissItem(item)}
                onRerun={() => dismissItem(item, true)}
              />
            ))}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {liveCount === 0 ? "No places" : liveCount === 1 ? "1 place" : `${liveCount} places`}
              </p>
              {drafts.map((d, i) => (
                <MentionCard key={d.key} draft={d} index={i} onChange={(next) => update(d.key, next)} />
              ))}
            </div>

            {adding && (
              <div className="rounded-xl border p-3 space-y-2" data-testid="add-place">
                <p className="text-sm font-medium">{adding.forItem ? `Find "${adding.forItem.payload?.place?.name ?? "the place"}"` : "Add a place this post mentions"}</p>
                <PlaceSearch inline autoFocus initialQuery={adding.forItem?.payload?.place?.name ?? ""} testId="add-place" onPick={addPlace} />
                <Button variant="ghost" size="sm" className="-mx-2" onClick={() => setAdding(null)}>
                  Cancel
                </Button>
              </div>
            )}

            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for the agents (optional)"
              className="text-sm"
              style={{ fontSize: "16px" }}
              data-testid="input-editor-note"
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-4 py-3 sm:rounded-b-xl">
        <Button variant="outline" size="sm" disabled={!data || pending} onClick={() => setAdding(adding ? null : {})} data-testid="button-add-place">
          Add place
        </Button>
        <Button
          variant={confirmNotAPlace ? "destructive" : "ghost"}
          size="sm"
          disabled={!data || pending}
          onClick={() => markNotAPlace()}
          data-testid="button-not-a-place"
        >
          {confirmNotAPlace ? "Remove all places?" : "Not a place"}
        </Button>
        <Button variant="ghost" size="sm" disabled={!data || pending} onClick={rerun} data-testid="button-rerun-post">
          Re-run
        </Button>
        <Button size="sm" className="ml-auto" disabled={!data || pending || (edits.length === 0 && changed === 0)} onClick={save} data-testid="button-save-mentions">
          {postAction.isPending ? "Saving..." : changed ? "Save" : "Confirm"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent data-testid="mention-editor-drawer">
          <DrawerTitle className="sr-only">Edit post</DrawerTitle>
          <div className="flex max-h-[85dvh] flex-col">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg" data-testid="mention-editor-dialog">
        <DialogTitle className="sr-only">Edit post</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** The pencil on a post (admin mode only): opens the mention editor. */
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
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setMounted(true);
          setOpen(true);
        }}
        data-testid={`button-edit-post-${postId}`}
      >
        <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
      </Button>
      {mounted && <MentionEditor postId={postId} open={open} onOpenChange={setOpen} />}
    </>
  );
}
