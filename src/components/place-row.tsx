"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Heart, CheckCircle } from "lucide-react";
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
  userId: string;
  placeId: string;
  status: "WANT" | "BEEN";
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface PlaceRowProps {
  savedPlace: SavedPlace;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export const PlaceRow = forwardRef<HTMLDivElement, PlaceRowProps>(
  (
    {
      savedPlace,
      isSelected,
      onSelect,
    },
    ref
  ) => {
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
        onClick={() => onSelect()}
      >
        <div
          ref={ref}
          className={cn(
            "flex items-center gap-3 p-1 rounded-lg cursor-pointer transition-colors",
            isSelected 
              ? "bg-accent" 
              : "hover:bg-accent"
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
              {savedPlace.status === "WANT" ? (
                <Heart className="h-3 w-3 fill-current text-rose-500" />
              ) : (
                <CheckCircle className="h-3 w-3 text-emerald-500" />
              )}
              <span>{savedPlace.status === "WANT" ? "Want" : "Been"}</span>
              {placeType && (
                <>
                  <span className="mx-1">·</span>
                  <span className="truncate">{placeType}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {address}
            </p>
          </div>
        </div>
      </Link>
    );
  }
);

PlaceRow.displayName = "PlaceRow";
