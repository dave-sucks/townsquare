"use client";

/**
 * One place in the chat's place list — the old chat's ChatPlaceCardInline
 * design (photo, Tuffy name with emoji, category, neighborhood, tag chips,
 * save control) grown into the spec's row (docs/AGENT_CHAT_REBUILD.md §9):
 *
 *   [48px photo]  🍔 Au Cheval                          [Save]
 *                 Burgers · $$ · West Village · 0.4 mi
 *                 (av)(av)(av) @a, @b +3 · 12 posts
 *                 [smash burger] [late night] [bar seating]
 *                 "the double with egg is the move" — @a, 3d ago  ›
 *
 * Row click → select + pan the map. Name → /places/[googlePlaceId]. The post
 * line expands to the post (media, caption, link out) — no Instagram embed
 * script in chat.
 */

import { forwardRef, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import type { PlaceRow } from "@/lib/agent/place-row";
import { Badge } from "@/components/ui/badge";
import { SaveToListDropdown } from "@/components/shared/save-to-list-dropdown";
import { FallbackImg, placePhotoUrl } from "@/components/chat/trace-items";
import { apiRequest } from "@/lib/query-client";
import { formatPriceLevel } from "@/lib/places/format";
import { cn } from "@/lib/utils";

// ── Live save state ─────────────────────────────────────────────────────────

type SavedPlaceApi = {
  id: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  emoji?: string | null;
  place: { id: string; googlePlaceId: string; lists?: { id: string }[]; listPlaces?: { list: { id: string } }[] };
};

/**
 * The same ["saved-places"] query the rest of the app uses, so a save made
 * anywhere (or by the agent's save tools, which invalidate it) shows here
 * without a reload. TanStack dedupes it across every row.
 */
function useSavedPlace(googlePlaceId: string) {
  const { data } = useQuery<{ savedPlaces: SavedPlaceApi[] }>({
    queryKey: ["saved-places"],
    queryFn: () => apiRequest("/api/saved-places"),
    staleTime: 30_000,
  });
  const sp = data?.savedPlaces?.find((s) => s.place.googlePlaceId === googlePlaceId);
  if (!sp) return { savedPlace: undefined, listIds: undefined as string[] | undefined, loaded: Boolean(data) };
  const listIds =
    sp.place.lists?.map((l) => l.id) ?? sp.place.listPlaces?.map((lp) => lp.list.id) ?? [];
  return {
    savedPlace: { id: sp.id, placeId: sp.placeId, hasBeen: sp.hasBeen, rating: sp.rating },
    listIds,
    emoji: sp.emoji ?? null,
    loaded: true,
  };
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Thumb({ place, size = 48 }: { place: PlaceRow; size?: number }) {
  const fallback = (
    <span className="flex size-full items-center justify-center text-xl">
      {place.emoji ?? <HugeiconsIcon icon={Location01Icon} className="size-5 text-muted-foreground" />}
    </span>
  );
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
      style={{ width: size, height: size }}
    >
      {place.photoRef ? (
        <FallbackImg src={placePhotoUrl(place.photoRef, size * 2)} fallback={fallback} className="size-full object-cover" />
      ) : (
        fallback
      )}
    </div>
  );
}

export function CreatorStack({ creators, postCount }: { creators: NonNullable<PlaceRow["creators"]>; postCount?: number }) {
  if (creators.length === 0) return null;
  const shown = creators.slice(0, 3);
  const names = creators.slice(0, 2).map((c) => `@${c.username}`).join(", ");
  const more = creators.length - 2;
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex shrink-0 -space-x-1.5">
        {shown.map((c) => (
          <span key={c.id} className="size-4 overflow-hidden rounded-full bg-muted ring-2 ring-background">
            {c.avatar ? (
              <FallbackImg
                src={c.avatar}
                referrerPolicy="no-referrer"
                className="size-full object-cover"
                fallback={
                  <span className="flex size-full items-center justify-center font-brand text-[8px]">
                    {c.username.charAt(0).toUpperCase()}
                  </span>
                }
              />
            ) : (
              <span className="flex size-full items-center justify-center font-brand text-[8px]">
                {c.username.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="min-w-0 truncate">
        {names}
        {more > 0 ? ` +${more}` : ""}
        {postCount ? <span className="tabular-nums"> · {postCount} {postCount === 1 ? "post" : "posts"}</span> : null}
      </span>
    </div>
  );
}

function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return null;
  }
}

function PostPreview({ post }: { post: NonNullable<PlaceRow["latestPost"]> }) {
  const [open, setOpen] = useState(false);
  const caption = post.caption?.replace(/\s+/g, " ").trim();
  if (!caption && !post.mediaUrl) return null;
  const when = timeAgo(post.postedAt);
  const quote = caption ? (caption.length > 70 ? `${caption.slice(0, 70).trimEnd()}…` : caption) : "Post";

  return (
    <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-0 items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          <span className="italic">“{quote}”</span> — @{post.creator}
          {when ? `, ${when}` : ""}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn("size-3 shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-1.5 flex gap-2 rounded-lg bg-muted/60 p-2 animate-in fade-in duration-200">
          {post.mediaUrl && (
            <FallbackImg
              src={post.mediaUrl}
              referrerPolicy="no-referrer"
              className="size-16 shrink-0 rounded-md object-cover"
              fallback={null}
            />
          )}
          <div className="min-w-0 flex-1">
            {caption && <p className="line-clamp-4 text-xs leading-relaxed text-foreground/90">{caption}</p>}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
              {typeof post.likes === "number" && <span>{post.likes.toLocaleString()} likes</span>}
              {post.url && (
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
                  View post ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── The row ─────────────────────────────────────────────────────────────────

export const PlaceRowCard = forwardRef<
  HTMLDivElement,
  {
    place: PlaceRow;
    selected: boolean;
    onSelect: () => void;
    /** The deep-dive view shows the post feed below instead. */
    hidePost?: boolean;
  }
>(function PlaceRowCard({ place, selected, onSelect, hidePost = false }, ref) {
  const live = useSavedPlace(place.googlePlaceId);
  const emoji = live.emoji ?? place.emoji;
  // SaveToListDropdown syncs its optimistic list state from this prop in an
  // effect keyed on the array itself, so hand it one stable array per set of
  // ids — a fresh array each render re-runs that effect every render (seen
  // 2026-09-24 as "Maximum update depth exceeded" mid-stream).
  const listIdsKey = (live.listIds ?? place.mySave?.listIds ?? []).join(",");
  const listIds = useMemo(() => (listIdsKey ? listIdsKey.split(",") : []), [listIdsKey]);
  const meta = [place.category, formatPriceLevel(place.priceLevel), place.neighborhood, place.distanceMi != null ? `${place.distanceMi} mi` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      data-selected={selected || undefined}
      className={cn(
        "group flex cursor-pointer gap-3 rounded-xl p-2 text-left transition-colors outline-none",
        "hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50",
        selected && "bg-muted",
      )}
      data-testid={`chat-place-${place.googlePlaceId}`}
    >
      <Thumb place={{ ...place, emoji }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-start gap-1">
          <Link
            href={`/places/${place.googlePlaceId}`}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 truncate font-brand text-[15px] leading-tight font-semibold hover:underline"
          >
            {emoji && <span className="mr-1">{emoji}</span>}
            {place.name}
          </Link>
          <div className="-mt-1 -mr-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <SaveToListDropdown
              place={{
                id: place.placeId ?? undefined,
                googlePlaceId: place.googlePlaceId,
                name: place.name,
                formattedAddress: place.address ?? place.neighborhood ?? "",
                lat: place.lat,
                lng: place.lng,
                priceLevel: place.priceLevel ?? null,
                photoRefs: place.photoRef ? [place.photoRef] : null,
              }}
              savedPlace={live.savedPlace}
              listsContainingPlace={listIds}
              showLabel={false}
              variant="ghost"
              size="icon"
            />
          </div>
        </div>
        {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        {place.creators && place.creators.length > 0 ? (
          <CreatorStack creators={place.creators} postCount={place.postCount} />
        ) : place.why ? (
          <p className="truncate text-xs text-muted-foreground">{place.why}</p>
        ) : null}
        {place.tags && place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {place.tags.slice(0, 3).map((t) => (
              <Badge key={t.slug} variant="secondary" className="font-normal">
                {t.displayName}
              </Badge>
            ))}
          </div>
        )}
        {place.latestPost && !hidePost && <PostPreview post={place.latestPost} />}
      </div>
    </div>
  );
});
