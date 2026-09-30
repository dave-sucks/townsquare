"use client";

/**
 * A chat place row IS the app's PlaceCard (components/shared/places-list):
 * the same row as My Places, lists and profiles. This adapter only maps the
 * agent's PlaceRow onto the card's props. The creator who posted it shows in
 * the location row via the card's own `showSavedBy` ("· @handle").
 */

import { forwardRef, useMemo, type ComponentProps } from "react";
import type { PlaceRow } from "@/lib/agent/place-row";
import { PlaceCard } from "@/components/shared/places-list";
import { useSavedPlace } from "@/components/chat/place-row-card";

type CardProps = ComponentProps<typeof PlaceCard>;

export const ChatPlaceCard = forwardRef<
  HTMLDivElement,
  { place: PlaceRow; selected: boolean; onSelect: () => void }
>(function ChatPlaceCard({ place, selected, onSelect }, ref) {
  const live = useSavedPlace(place.googlePlaceId);
  const creators = place.creators ?? [];

  const savedPlace = useMemo<CardProps["savedPlace"]>(
    () => ({
      id: place.googlePlaceId,
      placeId: place.placeId ?? place.googlePlaceId,
      hasBeen: false,
      rating: null,
      emoji: place.emoji ?? null,
      place: {
        id: place.placeId ?? place.googlePlaceId,
        googlePlaceId: place.googlePlaceId,
        name: place.name,
        formattedAddress: place.address ?? "",
        neighborhood: place.neighborhood ?? null,
        lat: place.lat,
        lng: place.lng,
        // PlaceRow carries the humanized category; the card re-derives it from a type.
        primaryType: place.category ? place.category.toLowerCase().replace(/\s+/g, "_") : null,
        types: null,
        priceLevel: place.priceLevel ?? null,
        photoRefs: place.photoRef ? [place.photoRef] : null,
        topTags: (place.tags ?? []).map((t) => ({ id: t.slug, slug: t.slug, displayName: t.displayName })),
      },
      savedBy: creators[0]
        ? {
            id: creators[0].id,
            username: creators.length > 1 ? `${creators[0].username} +${creators.length - 1}` : creators[0].username,
            firstName: null,
            lastName: null,
            profileImageUrl: creators[0].avatar ?? null,
          }
        : null,
    }),
    [place, creators],
  );

  const listIdsKey = (live.listIds ?? place.mySave?.listIds ?? []).join(",");
  const currentUserData = useMemo<CardProps["currentUserData"]>(() => {
    const saved = live.savedPlace;
    if (saved) {
      return {
        savedPlaceId: saved.id,
        hasBeen: saved.hasBeen,
        rating: saved.rating,
        emoji: live.emoji ?? null,
        lists: listIdsKey ? listIdsKey.split(",").map((id) => ({ id, name: "" })) : [],
      };
    }
    if (!live.loaded && place.mySave?.saved) {
      return {
        savedPlaceId: null,
        hasBeen: place.mySave.hasBeen,
        rating: place.mySave.rating ?? null,
        lists: listIdsKey ? listIdsKey.split(",").map((id) => ({ id, name: "" })) : [],
      };
    }
    return null;
  }, [live.savedPlace, live.emoji, live.loaded, place.mySave, listIdsKey]);

  return (
    <PlaceCard
      ref={ref}
      savedPlace={savedPlace}
      isSelected={selected}
      onClick={onSelect}
      showStatus={false}
      showSaveDropdown
      showSavedBy
      currentUserData={currentUserData}
    />
  );
});
