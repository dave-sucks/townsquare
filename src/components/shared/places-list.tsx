"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, CheckCircle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface SavedPlace {
  id: string;
  userId?: string;
  placeId: string;
  status: "WANT" | "BEEN";
  visitedAt?: string | null;
  createdAt?: string;
  place: Place;
}

interface PlaceCardProps {
  savedPlace: SavedPlace;
  isSelected: boolean;
  onSelect: () => void;
  showStatus?: boolean;
  actionButton?: React.ReactNode;
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export const PlaceCard = forwardRef<HTMLDivElement, PlaceCardProps>(
  ({ savedPlace, isSelected, onSelect, showStatus = true, actionButton }, ref) => {
    const photoRef = savedPlace.place.photoRefs?.[0];
    const photoUrl = photoRef 
      ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
      : null;
    
    const placeType = formatPlaceType(savedPlace.place.primaryType);
    const address = savedPlace.place.formattedAddress.split(",")[0];

    return (
      <Link
        href={`/places/${savedPlace.place.googlePlaceId}`}
        data-testid={`place-row-${savedPlace.id}`}
        onClick={(e) => {
          e.preventDefault();
          onSelect();
        }}
      >
        <div
          ref={ref}
          className={cn(
            "group flex items-center gap-3 p-1 rounded-lg cursor-pointer transition-colors hover-elevate",
            isSelected && "bg-accent"
          )}
          data-testid={`place-card-${savedPlace.id}`}
          data-selected={isSelected}
        >
          <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={savedPlace.place.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {savedPlace.status === "WANT" ? (
                  <Heart className="h-6 w-6" />
                ) : (
                  <CheckCircle className="h-6 w-6" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-medium text-sm truncate">
              {savedPlace.place.name}
            </h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              {showStatus && (
                <>
                  {savedPlace.status === "WANT" ? (
                    <Heart className="h-3 w-3 fill-current text-rose-500" />
                  ) : (
                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                  )}
                  <span>{savedPlace.status === "WANT" ? "Want" : "Been"}</span>
                  {placeType && <span className="mx-1">·</span>}
                </>
              )}
              {placeType && <span className="truncate">{placeType}</span>}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {address}
            </p>
          </div>
          {actionButton}
        </div>
      </Link>
    );
  }
);

PlaceCard.displayName = "PlaceCard";

interface PlacesListProps {
  places: SavedPlace[];
  isLoading?: boolean;
  selectedPlaceId: string | null;
  onPlaceSelect: (savedPlaceId: string) => void;
  placeRowRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
  showStatus?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
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
          onSelect={() => onPlaceSelect(savedPlace.id)}
          showStatus={showStatus}
          actionButton={renderAction?.(savedPlace)}
        />
      ))}
    </div>
  );
}
