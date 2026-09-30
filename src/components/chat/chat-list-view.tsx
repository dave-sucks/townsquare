"use client";

/**
 * What the chat panel shows over the chat: a list the agent made, then a
 * place from it. The same screens as a list page (ListSidebar's header,
 * PlaceCard rows, PlaceDetailPanel), with back returning to the chat.
 */

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { PlaceRow } from "@/lib/agent/place-row";
import { useChatMap, type PanelView, type ResultSet } from "@/components/chat/chat-map-context";
import { ChatPlaceCard } from "@/components/chat/chat-place-card";
import { CreatorHeaderCard } from "@/components/chat/place-detail-parts";
import { SaveAllToListButton } from "@/components/chat/save-all-to-list-button";
import { PlaceDetailPanel } from "@/components/place-detail-panel";
import { Button } from "@/components/ui/button";

export function ChatListView({ view }: { view: PanelView }) {
  const { resultSets, back } = useChatMap();
  const set = resultSets.get(view.setId);
  if (!set) return null;

  if (view.kind === "place") {
    const place = set.places.find((p) => p.googlePlaceId === view.key);
    if (!place) return null;
    return <PlaceDetailPanel savedPlace={toDetailPlace(place)} onBack={back} onDelete={() => {}} />;
  }

  return <ListView setId={view.setId} set={set} />;
}

function ListView({ setId, set }: { setId: string; set: ResultSet }) {
  const { selectedKey, openPlace, back, panTo } = useChatMap();
  const rows = useRef(new Map<string, HTMLDivElement>());
  const count = set.total > set.places.length ? `${set.places.length} of ${set.total}` : `${set.places.length}`;

  // Coming back from a place: keep its row in view.
  useEffect(() => {
    if (selectedKey) rows.current.get(selectedKey)?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);

  return (
    <div className="flex h-full flex-col bg-background" data-testid="chat-list-view">
      <div className="flex items-center gap-2 border-b p-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Back to chat" data-testid="button-back-to-chat">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
        </Button>
        <span className="flex-1 truncate font-brand text-sm font-semibold">{set.title}</span>
        <SaveAllToListButton places={set.places} />
      </div>

      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{set.label}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {count} {set.places.length === 1 ? "place" : "places"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {set.creator && (
          <div className="p-2 pb-1">
            <CreatorHeaderCard creator={set.creator} />
          </div>
        )}
        <div className="flex flex-col gap-1 p-1">
          {set.places.map((p) => (
            <ChatPlaceCard
              key={p.googlePlaceId}
              ref={(el) => {
                if (el) rows.current.set(p.googlePlaceId, el);
                else rows.current.delete(p.googlePlaceId);
              }}
              place={p}
              selected={selectedKey === p.googlePlaceId}
              onSelect={() => {
                openPlace(setId, p.googlePlaceId);
                panTo(p.lat, p.lng);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** PlaceRow → PlaceDetailPanel's savedPlace; the panel fetches the rest by googlePlaceId. */
function toDetailPlace(p: PlaceRow) {
  return {
    id: p.googlePlaceId,
    userId: null,
    placeId: p.placeId ?? p.googlePlaceId,
    hasBeen: false,
    rating: null,
    emoji: p.emoji ?? null,
    visitedAt: null,
    createdAt: "",
    place: {
      id: p.placeId ?? p.googlePlaceId,
      googlePlaceId: p.googlePlaceId,
      name: p.name,
      formattedAddress: p.address ?? "",
      neighborhood: p.neighborhood ?? null,
      lat: p.lat,
      lng: p.lng,
      primaryType: p.category ? p.category.toLowerCase().replace(/\s+/g, "_") : null,
      types: null,
      priceLevel: p.priceLevel ?? null,
      photoRefs: p.photoRef ? [p.photoRef] : null,
    },
  };
}
