"use client";

/**
 * PlaceListRenderer — ui: "place-list". The one loud component: the place
 * answer the user came for (docs/AGENT_CHAT_REBUILD.md §9).
 *
 *   Searching Townsquare for burgers · 7 places        [List | Map]  ›
 *   ┌ PlaceRowCard × 5, then "Show N more"            (List)
 *   └ PlaceMapCarousel: pins + swipeable cards        (Map)
 *   [Show on map]   [Save all to list]
 *
 * Registers its places with ChatMapProvider (the big map shows the newest
 * set, or whichever list was touched last) and shares selection with it.
 * Mobile defaults to the Map view — the big map is behind the bottom sheet.
 */

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MapsLocation01Icon, LeftToRightListBulletIcon } from "@hugeicons/core-free-icons";
import type { ToolResult } from "@/lib/agent/tool-result";
import type { PlaceListData, PlaceRow } from "@/lib/agent/place-row";
import { toolLabel } from "@/lib/agent/tool-labels";
import { useChatMap } from "@/components/chat/chat-map-context";
import { pastTense } from "@/components/chat/chain-of-thought";
import { PlaceRowCard } from "@/components/chat/place-row-card";
import { PlaceMapCarousel } from "@/components/chat/place-map-carousel";
import { SaveAllToListButton } from "@/components/chat/save-all-to-list-button";
import { CreatorHeaderCard, PlaceBuzz } from "@/components/chat/place-detail-parts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const PAGE = 5;

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
  const doneLabel = pastTense(label);

  const { registerResultSet, activateSet, activeSetId, selectedKey, setSelected, registerRow, panTo } = useChatMap();
  const [view, setView] = useState<"list" | "map" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(true);
  const effectiveView = view ?? (isMobile ? "map" : "list");
  const isActive = activeSetId === setId;

  useEffect(() => {
    if (!loading && places.length > 0) registerResultSet(setId, places);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, setId, places.map((p) => p.googlePlaceId).join("|")]);

  const select = (p: PlaceRow, source: "list" | "carousel" | "map") => {
    activateSet(setId);
    setSelected(p.googlePlaceId, source === "map" ? "map" : "list");
    if (source !== "map") panTo(p.lat, p.lng);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="my-2 flex flex-col gap-2" data-testid="place-list-loading">
        <div className="flex items-center gap-2 px-0.5">
          <span className="shimmer-text text-[13px] font-medium">{label}</span>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 p-2">
            <Skeleton className="size-12 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5 py-0.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (places.length === 0) {
    return (
      <p className="my-2 px-0.5 text-[13px] text-muted-foreground">
        {label} — nothing on Townsquare matches yet.
      </p>
    );
  }

  // get_place: one place, its summary and posts — no toggle, no list chrome.
  const isDetail = places.length === 1 && Array.isArray(data?.posts);
  const shown = expanded ? places : places.slice(0, PAGE);
  const hidden = places.length - shown.length;
  const count = data?.total && data.total > places.length ? `${places.length} of ${data.total}` : `${places.length}`;

  return (
    <div
      className="my-2 flex flex-col gap-1.5"
      onPointerEnter={() => !isMobile && activateSet(setId)}
      data-testid="place-list"
    >
      {/* Header — muted, collapsible; the view toggle sits on the right. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-muted"
        >
          <span className="min-w-0 truncate text-[13px] font-medium text-muted-foreground">
            {doneLabel}
            <span className="tabular-nums"> · {count} {places.length === 1 ? "place" : "places"}</span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground/70 transition-transform duration-300"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && !isDetail && (
          <div className="flex shrink-0 items-center rounded-lg bg-muted p-0.5" role="tablist" aria-label="View">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={effectiveView === v}
                aria-label={v === "list" ? "List" : "Map"}
                onClick={() => setView(v)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors",
                  effectiveView === v && "bg-background text-foreground shadow-xs",
                )}
              >
                <HugeiconsIcon icon={v === "list" ? LeftToRightListBulletIcon : MapsLocation01Icon} className="size-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && isDetail && (
        <div className="flex flex-col gap-1.5">
          <div className="-mx-2">
            <PlaceRowCard
              ref={(el) => registerRow(setId, places[0].googlePlaceId, el)}
              place={places[0]}
              selected={isActive && selectedKey === places[0].googlePlaceId}
              onSelect={() => select(places[0], "list")}
              hidePost
            />
          </div>
          <PlaceBuzz aiSummary={data?.aiSummary} posts={data?.posts ?? []} />
        </div>
      )}

      {open && !isDetail && (
        <>
          {data?.creator && <CreatorHeaderCard creator={data.creator} />}
          {effectiveView === "map" ? (
            <PlaceMapCarousel
              places={places}
              selectedKey={isActive ? selectedKey : null}
              onSelect={(p, source) => select(p, source)}
            />
          ) : (
            <div className={cn("-mx-2 flex flex-col", !isActive && "opacity-90")}>
              {shown.map((p) => (
                <PlaceRowCard
                  key={p.googlePlaceId}
                  ref={(el) => registerRow(setId, p.googlePlaceId, el)}
                  place={p}
                  selected={isActive && selectedKey === p.googlePlaceId}
                  onSelect={() => select(p, "list")}
                />
              ))}
              {hidden > 0 && (
                <Button variant="ghost" size="sm" className="mx-2 justify-start text-muted-foreground" onClick={() => setExpanded(true)}>
                  Show {hidden} more
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {!isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  activateSet(setId);
                  setSelected(null, "list");
                }}
                disabled={isActive && !selectedKey}
              >
                <HugeiconsIcon icon={MapsLocation01Icon} />
                {isActive ? "On the map" : "Show on map"}
              </Button>
            )}
            <SaveAllToListButton places={places} />
          </div>
        </>
      )}
    </div>
  );
}
