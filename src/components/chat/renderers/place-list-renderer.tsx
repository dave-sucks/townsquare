"use client";

/**
 * PlaceListRenderer — ui: "place-list". A list the agent made shows in the
 * chat as one card; the list itself opens in the panel (ChatListView), the
 * same way a list page shows a list, while its pins go on the big map.
 *
 *   [▣▣▣]  Burgers in West Village          ›
 *          7 places · 3 creators
 *
 * get_place is one place, not a list: its row and buzz render inline.
 */

import { useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import type { ToolResult } from "@/lib/agent/tool-result";
import type { PlaceListData, PlaceRow } from "@/lib/agent/place-row";
import { listTitle, toolLabel } from "@/lib/agent/tool-labels";
import { useChatMap } from "@/components/chat/chat-map-context";
import { pastTense } from "@/components/chat/chain-of-thought";
import { ChatPlaceCard } from "@/components/chat/chat-place-card";
import { PlaceBuzz } from "@/components/chat/place-detail-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface Props {
  toolName: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result: Extract<ToolResult, { ok: true }>;
  loading: boolean;
}

function isPlaceListData(d: unknown): d is PlaceListData {
  return Boolean(d && typeof d === "object" && Array.isArray((d as PlaceListData).places));
}

export function PlaceListRenderer({ toolName, toolCallId, args, result, loading }: Props) {
  const isMobile = useIsMobile();
  const setId = toolCallId ?? `${toolName}:${JSON.stringify(args ?? {})}`;
  const data = isPlaceListData(result.data) ? result.data : null;
  const places: PlaceRow[] = data?.places ?? [];
  const label = result.progressLabel ?? toolLabel(toolName, args);
  const isDetail = places.length === 1 && Array.isArray(data?.posts);
  const title = isDetail ? places[0].name : listTitle(toolName, args, data?.query);

  const { registerResultSet, activateSet, activeSetId, selectedKey, openList, openPlace } = useChatMap();

  useEffect(() => {
    if (loading || places.length === 0) return;
    registerResultSet(setId, {
      places,
      title,
      label: pastTense(label),
      total: data?.total ?? places.length,
      creator: data?.creator,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, setId, title, places.map((p) => p.googlePlaceId).join("|")]);

  if (loading) {
    return (
      <div className="my-2 flex items-center gap-3 rounded-xl border p-2" data-testid="place-list-loading">
        <Skeleton className="size-10 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="shimmer-text truncate text-[13px]">{label}</span>
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <p className="my-2 px-0.5 text-[13px] text-muted-foreground/75">
        {pastTense(label)} · nothing on Townsquare matches yet
      </p>
    );
  }

  if (isDetail) {
    const p = places[0];
    return (
      <div className="my-2 flex flex-col gap-1.5" onPointerEnter={() => !isMobile && activateSet(setId)}>
        <div className="-mx-1">
          <ChatPlaceCard
            place={p}
            selected={activeSetId === setId && selectedKey === p.googlePlaceId}
            onSelect={() => openPlace(setId, p.googlePlaceId)}
          />
        </div>
        <PlaceBuzz aiSummary={data?.aiSummary} posts={data?.posts ?? []} />
      </div>
    );
  }

  const total = data?.total && data.total > places.length ? `${places.length} of ${data.total}` : `${places.length}`;
  // A creator's own list doesn't need "· 1 creator".
  const creators = data?.creator ? 0 : new Set(places.flatMap((p) => (p.creators ?? []).map((c) => c.id))).size;

  return (
    <button
      type="button"
      onClick={() => openList(setId)}
      onPointerEnter={() => !isMobile && activateSet(setId)}
      className="group my-2 flex w-full items-center gap-3 rounded-xl border bg-background p-2 text-left transition-colors hover:bg-accent"
      data-testid="place-list-card"
    >
      <Thumbs places={places} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-brand text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {total} {places.length === 1 ? "place" : "places"}
          {creators > 0 && ` · ${creators} ${creators === 1 ? "creator" : "creators"}`}
        </p>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

/** Up to three of the list's photos, stacked. */
function Thumbs({ places }: { places: PlaceRow[] }) {
  const shown = places.slice(0, 3);
  return (
    <div className="flex shrink-0 -space-x-5">
      {shown.map((p, i) => (
        <div
          key={p.googlePlaceId}
          className={cn(
            "flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted ring-2 ring-background",
            i > 0 && "shadow-sm",
          )}
          style={{ zIndex: shown.length - i }}
        >
          {p.photoRef ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/places/photo?photoRef=${encodeURIComponent(p.photoRef)}&placeId=${encodeURIComponent(p.googlePlaceId)}&maxWidth=96`}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : p.emoji ? (
            <span className="text-lg">{p.emoji}</span>
          ) : (
            <HugeiconsIcon icon={Location01Icon} className="size-4 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}
