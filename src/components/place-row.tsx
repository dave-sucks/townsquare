"use client";

import { forwardRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, CheckCircle, Trash2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const placeRowVariants = cva(
  "cursor-pointer transition-colors",
  {
    variants: {
      selected: {
        true: "ring-2 ring-primary ring-offset-2",
        false: "hover-elevate",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

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

interface PlaceRowProps extends VariantProps<typeof placeRowVariants> {
  savedPlace: SavedPlace;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export const PlaceRow = forwardRef<HTMLDivElement, PlaceRowProps>(
  (
    {
      savedPlace,
      isSelected,
      onSelect,
      onToggleStatus,
      onDelete,
      isUpdating,
      isDeleting,
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        className={cn(placeRowVariants({ selected: isSelected }))}
        onClick={onSelect}
        data-testid={`place-card-${savedPlace.id}`}
        data-selected={isSelected}
      >
        <CardHeader className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">
                {savedPlace.place.name}
              </CardTitle>
              <CardDescription className="mt-1 truncate">
                {savedPlace.place.formattedAddress}
              </CardDescription>
            </div>
            <Badge variant={savedPlace.status === "WANT" ? "secondary" : "default"}>
              {savedPlace.status === "WANT" ? (
                <>
                  <Heart className="mr-1 h-3 w-3" />
                  Want
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Been
                </>
              )}
            </Badge>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus();
              }}
              disabled={isUpdating}
              data-testid={`button-toggle-status-${savedPlace.id}`}
            >
              {savedPlace.status === "WANT" ? "Mark as Been" : "Mark as Want"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isDeleting}
              data-testid={`button-delete-${savedPlace.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }
);

PlaceRow.displayName = "PlaceRow";
