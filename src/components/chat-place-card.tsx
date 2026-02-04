"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaveToListDropdown } from "./shared/save-to-list-dropdown";

interface PlaceResult {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  neighborhood?: string | null;
  locality?: string | null;
  lat: number;
  lng: number;
  types: string[];
  primaryType: string | null;
  priceLevel: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  photoRef: string | null;
}

interface SavedPlaceInfo {
  id: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  lists: Array<{ id: string; name: string }>;
}

interface ChatPlaceCardProps {
  place: PlaceResult;
  onSaved?: () => void;
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function ChatPlaceCard({ place, onSaved }: ChatPlaceCardProps) {
  const [savedPlaceInfo, setSavedPlaceInfo] = useState<SavedPlaceInfo | null>(null);
  
  const { data: savedPlacesData } = useQuery<{ savedPlaces: Array<{ id: string; placeId: string; hasBeen: boolean; rating: number | null; place: { googlePlaceId: string }; lists?: Array<{ id: string; name: string }> }> }>({
    queryKey: ["saved-places"],
  });

  useEffect(() => {
    if (savedPlacesData?.savedPlaces) {
      const found = savedPlacesData.savedPlaces.find(
        sp => sp.place.googlePlaceId === place.googlePlaceId
      );
      if (found) {
        setSavedPlaceInfo({
          id: found.id,
          placeId: found.placeId,
          hasBeen: found.hasBeen,
          rating: found.rating,
          lists: found.lists || [],
        });
      } else {
        setSavedPlaceInfo(null);
      }
    }
  }, [savedPlacesData, place.googlePlaceId]);

  const placeType = formatPlaceType(place.primaryType);
  const locationDisplay = place.neighborhood 
    || place.locality 
    || place.formattedAddress.split(",")[0];

  const placeForDropdown = {
    id: "",
    googlePlaceId: place.googlePlaceId,
    name: place.name,
    formattedAddress: place.formattedAddress,
    neighborhood: place.neighborhood || null,
    locality: place.locality || null,
    lat: place.lat,
    lng: place.lng,
    primaryType: place.primaryType,
    types: place.types,
    priceLevel: place.priceLevel,
    photoRefs: place.photoRef ? [place.photoRef] : null,
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-1 rounded-md transition-colors"
      )}
      data-testid={`chat-place-card-${place.googlePlaceId}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className="font-medium text-sm truncate">
            {place.name}
          </h3>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {locationDisplay}
              {placeType && <> — {placeType}</>}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex-shrink-0">
        <SaveToListDropdown
          place={placeForDropdown}
          savedPlace={savedPlaceInfo}
          listsContainingPlace={savedPlaceInfo?.lists?.map(l => l.id) || []}
          showLabel={false}
          variant="ghost"
          size="icon"
        />
      </div>
    </div>
  );
}

interface ChatPlaceCardsProps {
  places: PlaceResult[];
}

export function ChatPlaceCards({ places }: ChatPlaceCardsProps) {
  if (!places || places.length === 0) return null;

  return (
    <div className="space-y-2 my-3">
      {places.map((place) => (
        <ChatPlaceCard key={place.googlePlaceId} place={place} />
      ))}
    </div>
  );
}
