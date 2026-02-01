"use client";

import { forwardRef, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, CheckCircle, MapPin, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  showStatus?: boolean;
  onSave?: (status: "WANT" | "BEEN") => void;
  isSaving?: boolean;
  actionButton?: React.ReactNode;
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export const PlaceCard = forwardRef<HTMLDivElement, PlaceCardProps>(
  ({ savedPlace, isSelected, showStatus = true, onSave, isSaving, actionButton }, ref) => {
    const [popoverOpen, setPopoverOpen] = useState(false);
    
    const photoRef = savedPlace.place.photoRefs?.[0];
    const photoUrl = photoRef 
      ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
      : null;
    
    const placeType = formatPlaceType(savedPlace.place.primaryType);
    const address = savedPlace.place.formattedAddress.split(",")[0];

    const handleSave = (status: "WANT" | "BEEN") => {
      onSave?.(status);
      setPopoverOpen(false);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "group flex items-center gap-3 p-1 rounded-md transition-colors",
          isSelected ? "bg-accent" : "hover:bg-accent"
        )}
        data-testid={`place-card-${savedPlace.id}`}
        data-selected={isSelected}
      >
        <Link
          href={`/places/${savedPlace.place.googlePlaceId}`}
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
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              {placeType && <span className="truncate">{placeType}</span>}
              {showStatus && (
                <>
                  {placeType && <span className="mx-0.5">·</span>}
                  {savedPlace.status === "WANT" ? (
                    <Heart className="h-3 w-3 fill-current text-rose-500" />
                  ) : (
                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                  )}
                  <span>{savedPlace.status === "WANT" ? "Want" : "Been"}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {address}
            </p>
          </div>
        </Link>
        
        {onSave && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="invisible group-hover:visible flex-shrink-0"
                data-testid={`save-place-trigger-${savedPlace.id}`}
                disabled={isSaving}
                onClick={(e) => e.stopPropagation()}
              >
                <Bookmark className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => handleSave("WANT")}
                  data-testid={`save-as-want-${savedPlace.id}`}
                  disabled={isSaving}
                >
                  <Heart className="h-4 w-4 text-rose-500" />
                  Add as Want
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => handleSave("BEEN")}
                  data-testid={`save-as-been-${savedPlace.id}`}
                  disabled={isSaving}
                >
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Add as Been
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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
  onSavePlace?: (place: SavedPlace, status: "WANT" | "BEEN") => void;
  savingPlaceId?: string | null;
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
  onSavePlace,
  savingPlaceId,
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
          onSave={onSavePlace ? (status) => onSavePlace(savedPlace, status) : undefined}
          isSaving={savingPlaceId === savedPlace.id}
          actionButton={renderAction?.(savedPlace)}
        />
      ))}
    </div>
  );
}
