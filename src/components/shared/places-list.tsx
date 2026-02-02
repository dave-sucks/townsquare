"use client";

import { forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SaveToListDropdown } from "./save-to-list-dropdown";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  primaryType: string | null;
  types: string[] | null;
  priceLevel: string | null;
  photoRefs: string[] | null;
}

interface ListInfo {
  id: string;
  name: string;
}

interface SavedPlace {
  id: string;
  userId?: string;
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
  visitedAt?: string | null;
  createdAt?: string;
  place: Place;
  lists?: ListInfo[];
}

const RATING_COLORS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-yellow-500",
  3: "bg-green-500",
};

interface PlaceCardProps {
  savedPlace: SavedPlace;
  isSelected: boolean;
  showStatus?: boolean;
  showSaveDropdown?: boolean;
  listsContainingPlace?: string[];
  actionButton?: React.ReactNode;
  onClick?: () => void;
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export const PlaceCard = forwardRef<HTMLDivElement, PlaceCardProps>(
  ({ savedPlace, isSelected, showStatus = true, showSaveDropdown = false, listsContainingPlace = [], actionButton, onClick }, ref) => {
    const photoRef = savedPlace.place.photoRefs?.[0];
    const photoUrl = photoRef 
      ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
      : null;
    
    const placeType = formatPlaceType(savedPlace.place.primaryType);
    const address = savedPlace.place.formattedAddress.split(",")[0];

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(
          "group flex items-center gap-3 p-1 rounded-md transition-colors cursor-pointer",
          isSelected ? "bg-accent" : "hover:bg-accent"
        )}
        data-testid={`place-card-${savedPlace.id}`}
        data-selected={isSelected}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <div
          data-testid={`place-row-${savedPlace.id}`}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={savedPlace.place.name}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-medium text-sm truncate">
              {savedPlace.place.name}
            </h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {placeType && <span className="truncate">{placeType}</span>}
              {showStatus && savedPlace.hasBeen && (
                <>
                  {placeType && <span className="mx-0.5">·</span>}
                  <span 
                    className={cn(
                      "inline-block w-2.5 h-2.5 rounded-full",
                      savedPlace.rating ? RATING_COLORS[savedPlace.rating] : "bg-green-500"
                    )} 
                  />
                  <span>Been</span>
                </>
              )}
              {showStatus && !savedPlace.hasBeen && (
                <>
                  {placeType && <span className="mx-0.5">·</span>}
                  <Bookmark className="h-3 w-3" />
                  {savedPlace.lists && savedPlace.lists.length > 0 ? (
                    <>
                      <span className="truncate">{savedPlace.lists[0].name}</span>
                      {savedPlace.lists.length > 1 && (
                        <span className="text-muted-foreground">+{savedPlace.lists.length - 1}</span>
                      )}
                    </>
                  ) : (
                    <span>Saved</span>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {address}
            </p>
          </div>
        </div>
        
        {showSaveDropdown && (
          <div className="invisible group-hover:visible flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <SaveToListDropdown
              place={savedPlace.place}
              savedPlace={{
                id: savedPlace.id,
                placeId: savedPlace.placeId,
                hasBeen: savedPlace.hasBeen,
                rating: savedPlace.rating,
              }}
              listsContainingPlace={listsContainingPlace}
              showLabel={false}
              variant="ghost"
              size="icon"
            />
          </div>
        )}
        {actionButton}
      </div>
    );
  }
);

PlaceCard.displayName = "PlaceCard";

interface PlacesListProps {
  places: SavedPlace[];
  isLoading?: boolean;
  selectedPlaceId: string | null;
  onPlaceSelect?: (savedPlaceId: string) => void;
  placeRowRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
  showStatus?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
  showSaveDropdown?: boolean;
  renderAction?: (savedPlace: SavedPlace) => React.ReactNode;
}

export function PlacesList({
  places,
  isLoading = false,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  showStatus = true,
  emptyMessage = "No places yet",
  emptySubMessage = "Search for a place on the map to add it",
  showSaveDropdown = false,
  renderAction,
}: PlacesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <MapPin className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{emptyMessage}</p>
        <p className="text-xs text-muted-foreground mt-1">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-1">
      {places.map((savedPlace) => (
        <PlaceCard
          key={savedPlace.id}
          ref={(el) => {
            if (placeRowRefs) {
              if (el) placeRowRefs.current.set(savedPlace.id, el);
              else placeRowRefs.current.delete(savedPlace.id);
            }
          }}
          savedPlace={savedPlace}
          isSelected={savedPlace.id === selectedPlaceId}
          showStatus={showStatus}
          showSaveDropdown={showSaveDropdown}
          actionButton={renderAction?.(savedPlace)}
          onClick={onPlaceSelect ? () => onPlaceSelect(savedPlace.id) : undefined}
        />
      ))}
    </div>
  );
}
