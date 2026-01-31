"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Heart, CheckCircle, Trash2, ExternalLink, List, Star, Plus } from "lucide-react";

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

interface Review {
  id: string;
  rating: number;
  note: string | null;
}

interface PlaceDetailsSheetProps {
  savedPlace: SavedPlace | null;
  myReview?: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onAddToList: () => void;
  onAddReview?: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function PlaceDetailsSheet({
  savedPlace,
  myReview,
  open,
  onOpenChange,
  onToggleStatus,
  onDelete,
  onAddToList,
  onAddReview,
  isUpdating,
  isDeleting,
}: PlaceDetailsSheetProps) {
  if (!savedPlace) return null;

  const googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${savedPlace.place.googlePlaceId}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0" data-testid="place-details-sheet">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-start gap-2">
            <Badge variant={savedPlace.status === "WANT" ? "secondary" : "default"}>
              {savedPlace.status === "WANT" ? (
                <><Heart className="mr-1 h-3 w-3" />Want</>
              ) : (
                <><CheckCircle className="mr-1 h-3 w-3" />Been</>
              )}
            </Badge>
            {myReview && (
              <Badge variant="outline" data-testid="sheet-badge-rating">
                <Star className="mr-1 h-3 w-3 fill-current text-yellow-500" />
                {myReview.rating}/10
              </Badge>
            )}
          </div>
          <SheetTitle className="text-left" data-testid="sheet-place-name">
            {savedPlace.place.name}
          </SheetTitle>
          <SheetDescription className="text-left" data-testid="sheet-place-address">
            {savedPlace.place.formattedAddress}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onToggleStatus}
                disabled={isUpdating}
                data-testid="sheet-button-toggle-status"
              >
                {savedPlace.status === "WANT" ? "Mark as Been" : "Mark as Want"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onAddToList}
                data-testid="sheet-button-add-to-list"
              >
                <List className="mr-1 h-4 w-4" />
                Add to List
              </Button>
              {!myReview && onAddReview && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAddReview}
                  data-testid="sheet-button-add-review"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Review
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" asChild data-testid="sheet-button-open-maps">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Google Maps
                </a>
              </Button>
              <Button size="sm" variant="ghost" asChild data-testid="sheet-button-open-details">
                <Link href={`/places/${savedPlace.place.googlePlaceId}`}>
                  View Full Details
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
                data-testid="sheet-button-delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
