"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, CheckCircle, X, Trash2, ExternalLink } from "lucide-react";

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

interface PlacePreviewProps {
  savedPlace: SavedPlace;
  onClose: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function PlacePreview({
  savedPlace,
  onClose,
  onToggleStatus,
  onDelete,
  isUpdating,
  isDeleting,
}: PlacePreviewProps) {
  const googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${savedPlace.place.googlePlaceId}`;

  return (
    <Card 
      className="absolute bottom-4 left-4 right-4 z-10 max-w-sm shadow-lg"
      data-testid="place-preview-card"
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate" data-testid="preview-place-name">
              {savedPlace.place.name}
            </CardTitle>
            <CardDescription className="mt-1 truncate" data-testid="preview-place-address">
              {savedPlace.place.formattedAddress}
            </CardDescription>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="shrink-0"
            data-testid="button-close-preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={savedPlace.status === "WANT" ? "secondary" : "default"}>
            {savedPlace.status === "WANT" ? (
              <>
                <Heart className="mr-1 h-3 w-3" />
                Want to visit
              </>
            ) : (
              <>
                <CheckCircle className="mr-1 h-3 w-3" />
                Been there
              </>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleStatus}
            disabled={isUpdating}
            data-testid="preview-button-toggle-status"
          >
            {savedPlace.status === "WANT" ? "Mark as Been" : "Mark as Want"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
            data-testid="preview-button-delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            asChild
            data-testid="preview-button-open-maps"
          >
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" />
              Google Maps
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
