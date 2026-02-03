"use client";

import { forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, Bookmark, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaveToListDropdown } from "./save-to-list-dropdown";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  neighborhood: string | null;
  locality: string | null;
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

const RATING_NAMES: Record<number, string> = {
  1: "Don't like",
  2: "Like",
  3: "Love",
};

interface PlaceCardProps {
  savedPlace: SavedPlace;
  isSelected: boolean;
  showStatus?: boolean;
  showSaveDropdown?: boolean;
  hideDropdownUntilHover?: boolean;
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
  ({ savedPlace, isSelected, showStatus = true, showSaveDropdown = false, hideDropdownUntilHover = false, listsContainingPlace = [], actionButton, onClick }, ref) => {
    const photoRef = savedPlace.place.photoRefs?.[0];
    const photoUrl = photoRef 
      ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
      : null;
    
    const placeType = formatPlaceType(savedPlace.place.primaryType);
    const locationDisplay = savedPlace.place.neighborhood 
      || savedPlace.place.locality 
      || savedPlace.place.formattedAddress.split(",")[0];

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
          <div className="relative w-16 h-16 flex-shrink-0">
            <div className="w-full h-full rounded-md overflow-hidden bg-muted">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={savedPlace.place.name}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
            {savedPlace.hasBeen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3">
                    {savedPlace.rating === 3 ? (
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-sky-500 border-2 border-background shadow-sm">
                        <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                      </span>
                    ) : savedPlace.rating === 1 ? (
                      <span className="block w-3 h-3 rounded-full bg-red-500 border-2 border-background shadow-sm" />
                    ) : (
                      <span className="block w-3 h-3 rounded-full bg-sky-500 border-2 border-background shadow-sm" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="flex items-center gap-1.5">
                  <span>You've Been Here. Rating:</span>
                  {savedPlace.rating === 3 ? (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-sky-500">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </span>
                  ) : savedPlace.rating === 1 ? (
                    <span className="block w-3 h-3 rounded-full bg-red-500" />
                  ) : (
                    <span className="block w-3 h-3 rounded-full bg-sky-500" />
                  )}
                  <span>{savedPlace.rating ? RATING_NAMES[savedPlace.rating] : "Love"}</span>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-medium text-sm truncate">
              {savedPlace.place.name}
            </h3>
            
            {showStatus && (savedPlace.hasBeen || (savedPlace.lists && savedPlace.lists.length > 0)) && (
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                {savedPlace.hasBeen && (
                  <span className="text-foreground">Been</span>
                )}
                {savedPlace.hasBeen && savedPlace.lists && savedPlace.lists.length > 0 && (
                  <span className="text-foreground">·</span>
                )}
                {savedPlace.lists && savedPlace.lists.length > 0 && (
                  <span className="text-foreground truncate">
                    {savedPlace.lists.map(l => l.name).join(" · ")}
                  </span>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {locationDisplay}
                {placeType && <> — {placeType}</>}
              </span>
            </div>
          </div>
        </div>
        
        {showSaveDropdown && (
          <div 
            className={cn(
              "flex-shrink-0",
              hideDropdownUntilHover && "opacity-0 group-hover:opacity-100 transition-opacity"
            )} 
            onClick={(e) => e.stopPropagation()}
          >
            <SaveToListDropdown
              place={savedPlace.place}
              savedPlace={{
                id: savedPlace.id,
                placeId: savedPlace.placeId,
                hasBeen: savedPlace.hasBeen,
                rating: savedPlace.rating,
              }}
              listsContainingPlace={savedPlace.lists?.map(l => l.id) || listsContainingPlace}
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
  hideDropdownUntilHover?: boolean;
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
  hideDropdownUntilHover = false,
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
          hideDropdownUntilHover={hideDropdownUntilHover}
          actionButton={renderAction?.(savedPlace)}
          onClick={onPlaceSelect ? () => onPlaceSelect(savedPlace.id) : undefined}
        />
      ))}
    </div>
  );
}
