"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, ChevronDown, Check, Star, Heart, CheckCircle } from "lucide-react";
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
  placeId: string;
  status: "WANT" | "BEEN";
  createdAt: string;
  place: Place;
}

interface ReviewData {
  id: string;
  rating: number;
  note: string | null;
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface ListData {
  id: string;
  name: string;
  visibility: "PRIVATE" | "PUBLIC";
  listPlaces: Array<{ placeId: string }>;
  _count: { listPlaces: number };
}

interface ProfilePlacesPanelProps {
  places: SavedPlace[];
  reviews: ReviewData[];
  lists: ListData[];
  isLoading: boolean;
  selectedPlaceId: string | null;
  selectedReviewId: string | null;
  selectedTab: "places" | "feed";
  selectedListId: string;
  selectedStatusFilter: string;
  onTabChange: (tab: "places" | "feed") => void;
  onListChange: (listId: string) => void;
  onStatusFilterChange: (status: string) => void;
  onPlaceSelect: (placeId: string) => void;
  onReviewSelect: (reviewId: string) => void;
  placeRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  reviewRowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "want", label: "Want" },
  { value: "been", label: "Been" },
];

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

const PlaceRow = forwardRef<HTMLDivElement, {
  savedPlace: SavedPlace;
  isSelected: boolean;
  onSelect: () => void;
}>(({ savedPlace, isSelected, onSelect }, ref) => {
  const photoRef = savedPlace.place.photoRefs?.[0];
  const photoUrl = photoRef 
    ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
    : null;
  
  const placeType = formatPlaceType(savedPlace.place.primaryType);
  const address = savedPlace.place.formattedAddress.split(",")[0];

  return (
    <Link
      href={`/places/${savedPlace.place.googlePlaceId}`}
      onClick={(e) => {
        e.preventDefault();
        onSelect();
      }}
      data-testid={`profile-place-row-${savedPlace.id}`}
    >
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 p-1 rounded-lg cursor-pointer transition-colors",
          isSelected ? "bg-accent" : "hover:bg-accent"
        )}
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
});
PlaceRow.displayName = "PlaceRow";

const ReviewRow = forwardRef<HTMLDivElement, {
  review: ReviewData;
  isSelected: boolean;
  onSelect: () => void;
}>(({ review, isSelected, onSelect }, ref) => {
  const photoRef = review.place.photoRefs?.[0];
  const photoUrl = photoRef 
    ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
    : null;
  
  const placeType = formatPlaceType(review.place.primaryType);
  const address = review.place.formattedAddress.split(",")[0];

  return (
    <Link
      href={`/places/${review.place.googlePlaceId}`}
      onClick={(e) => {
        e.preventDefault();
        onSelect();
      }}
      data-testid={`profile-review-row-${review.id}`}
    >
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 p-1 rounded-lg cursor-pointer transition-colors",
          isSelected ? "bg-accent" : "hover:bg-accent"
        )}
        data-selected={isSelected}
      >
        <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={review.place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Star className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className="font-medium text-sm truncate">
            {review.place.name}
          </h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Star className="h-3 w-3 fill-current text-amber-500" />
            <span>{review.rating}/10</span>
            {placeType && (
              <>
                <span className="mx-1">·</span>
                <span className="truncate">{placeType}</span>
              </>
            )}
          </div>
          {review.note ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {review.note}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {address}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
});
ReviewRow.displayName = "ReviewRow";

export function ProfilePlacesPanel({
  places,
  reviews,
  lists,
  isLoading,
  selectedPlaceId,
  selectedReviewId,
  selectedTab,
  selectedListId,
  selectedStatusFilter,
  onTabChange,
  onListChange,
  onStatusFilterChange,
  onPlaceSelect,
  onReviewSelect,
  placeRowRefs,
  reviewRowRefs,
}: ProfilePlacesPanelProps) {
  const selectedStatusLabel = statusOptions.find((o) => o.value === selectedStatusFilter)?.label || "All";
  const selectedListLabel = selectedListId === "all" 
    ? "All Lists" 
    : lists.find((l) => l.id === selectedListId)?.name || "All Lists";

  return (
    <div className="h-full flex flex-col bg-background" data-testid="profile-places-panel">
      <div className="sticky top-0 z-10 bg-background border-b">
        <Tabs value={selectedTab} onValueChange={(v) => onTabChange(v as "places" | "feed")} className="w-full">
          <TabsList className="w-full justify-start bg-transparent rounded-none h-auto p-0 px-3 gap-4">
            <TabsTrigger 
              value="places" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-0 py-3"
              data-testid="profile-tab-places"
            >
              <MapPin className="mr-1.5 h-4 w-4" />
              Places
              <span className="ml-1.5 text-muted-foreground">{places.length}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="feed"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-0 py-3"
              data-testid="profile-tab-feed"
            >
              <Star className="mr-1.5 h-4 w-4" />
              Feed
              <span className="ml-1.5 text-muted-foreground">{reviews.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {selectedTab === "places" && (
          <div className="flex gap-2 p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="profile-select-status-filter">
                  {selectedStatusLabel}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statusOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => onStatusFilterChange(option.value)}
                    data-active={selectedStatusFilter === option.value}
                  >
                    {option.label}
                    <Check className={`ml-auto h-4 w-4 ${selectedStatusFilter === option.value ? "opacity-100" : "opacity-0"}`} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="profile-select-list-filter">
                  {selectedListLabel}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => onListChange("all")}
                  data-active={selectedListId === "all"}
                >
                  All Lists
                  <Check className={`ml-auto h-4 w-4 ${selectedListId === "all" ? "opacity-100" : "opacity-0"}`} />
                </DropdownMenuItem>
                {lists.map((list) => (
                  <DropdownMenuItem
                    key={list.id}
                    onSelect={() => onListChange(list.id)}
                    data-active={selectedListId === list.id}
                  >
                    {list.name}
                    <Check className={`ml-auto h-4 w-4 ${selectedListId === list.id ? "opacity-100" : "opacity-0"}`} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto p-1 gap-1 space-y-1">
        {isLoading ? (
          <div className="space-y-3 p-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : selectedTab === "places" ? (
          places.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No places yet</p>
                <p className="text-sm text-muted-foreground">No saved places to display</p>
              </CardContent>
            </Card>
          ) : (
            places.map((savedPlace) => (
              <PlaceRow
                key={savedPlace.id}
                ref={(el) => {
                  if (el) placeRowRefs.current.set(savedPlace.id, el);
                  else placeRowRefs.current.delete(savedPlace.id);
                }}
                savedPlace={savedPlace}
                isSelected={savedPlace.id === selectedPlaceId}
                onSelect={() => onPlaceSelect(savedPlace.id)}
              />
            ))
          )
        ) : (
          reviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No reviews yet</p>
                <p className="text-sm text-muted-foreground">No reviews to display</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <ReviewRow
                key={review.id}
                ref={(el) => {
                  if (el) reviewRowRefs.current.set(review.id, el);
                  else reviewRowRefs.current.delete(review.id);
                }}
                review={review}
                isSelected={review.id === selectedReviewId}
                onSelect={() => onReviewSelect(review.id)}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}
