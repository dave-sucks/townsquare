"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { 
  ExternalLink, 
  Star, 
  X,
  ArrowRightFromLine,
  Utensils,
  MapPin,
  BadgeCheck,
  List as ListIcon,
  ChevronRight,
} from "lucide-react";
import { PlacePhotoGrid } from "./place-photo-grid";
import { SaveToListDropdown } from "./shared/save-to-list-dropdown";
import { FeedPost } from "./feed-post";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Place {
  id: string;
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  neighborhood?: string | null;
  locality?: string | null;
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
  hasBeen: boolean;
  rating: number | null;
  visitedAt: string | null;
  createdAt: string;
  place: Place;
}

interface Review {
  id: string;
  rating: number;
  note: string | null;
}

interface Photo {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

interface FriendSaved {
  id: string;
  hasBeen: boolean;
  rating: number | null;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

interface ListInfo {
  id: string;
  name: string;
  visibility?: string;
  _count?: {
    listPlaces: number;
  };
}

interface Activity {
  id: string;
  actorId: string;
  type: "PLACE_SAVED" | "PLACE_MARKED_BEEN" | "PLACE_ADDED_TO_LIST" | "LIST_CREATED" | "REVIEW_CREATED";
  placeId: string | null;
  listId: string | null;
  createdAt: string;
  actor: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  place: {
    id: string;
    googlePlaceId: string;
    name: string;
    formattedAddress: string;
    photoRefs?: string[] | null;
  } | null;
  list: {
    id: string;
    name: string;
    visibility: string;
    userId: string;
  } | null;
  metadata: { placeName?: string; listName?: string; rating?: number; note?: string; review_preview?: string } | null;
}

interface PlaceDetailsSheetProps {
  savedPlace: SavedPlace | null;
  myReview?: Review | null;
  photos?: Photo[];
  friendsWhoSaved?: FriendSaved[];
  listsContainingPlace?: string[];
  listsData?: ListInfo[];
  activities?: Activity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onAddReview?: () => void;
  isDeleting?: boolean;
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatPriceLevel(priceLevel: string | null): string {
  if (!priceLevel) return "";
  const levels: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return levels[priceLevel] || "";
}

const RATING_LABELS: Record<number, string> = {
  1: "ehh",
  3: "liked",
  5: "loved",
};

function ListRowCard({ list }: { list: ListInfo }) {
  return (
    <Link 
      href={`/lists/${list.id}`}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate min-w-[200px]"
      data-testid={`list-row-${list.id}`}
    >
      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
        <ListIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{list.name}</p>
        <p className="text-xs text-muted-foreground">
          {list._count?.listPlaces || 0} places
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

export function PlaceDetailsSheet({
  savedPlace,
  myReview,
  photos = [],
  friendsWhoSaved = [],
  listsContainingPlace = [],
  listsData = [],
  activities = [],
  open,
  onOpenChange,
  onDelete,
  onAddReview,
  isDeleting,
}: PlaceDetailsSheetProps) {
  if (!savedPlace) return null;

  const place = savedPlace.place;
  const googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`;
  const placeType = formatPlaceType(place.primaryType);
  const priceLevel = formatPriceLevel(place.priceLevel);
  
  const locationDisplay = place.neighborhood || place.locality || "";
  const listsForThisPlace = listsData.filter(l => listsContainingPlace.includes(l.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" data-testid="place-details-sheet">
        <VisuallyHidden>
          <SheetTitle>{place.name}</SheetTitle>
          <SheetDescription>{place.formattedAddress}</SheetDescription>
        </VisuallyHidden>
        
        <div className="flex items-center justify-between gap-2 p-3 border-b flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-sheet"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              data-testid="button-expand-sheet"
            >
              <Link href={`/places/${place.googlePlaceId}`}>
                <ArrowRightFromLine className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <SaveToListDropdown
            place={place}
            savedPlace={{
              id: savedPlace.id,
              placeId: savedPlace.placeId,
              hasBeen: savedPlace.hasBeen,
              rating: savedPlace.rating,
            }}
            listsContainingPlace={listsContainingPlace}
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold" data-testid="sheet-place-name">
                {place.name}
              </h1>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {placeType && (
                  <div className="flex items-center gap-1">
                    <Utensils className="h-3.5 w-3.5" />
                    <span>{placeType}</span>
                  </div>
                )}
                {priceLevel && (
                  <>
                    <span>·</span>
                    <span>{priceLevel}</span>
                  </>
                )}
                {locationDisplay && (
                  <>
                    <span>·</span>
                    <span>{locationDisplay}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm flex-wrap">
                {savedPlace.hasBeen && (
                  <Badge variant="secondary" className="gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    {savedPlace.rating ? RATING_LABELS[savedPlace.rating] : "Been"}
                  </Badge>
                )}
                {listsForThisPlace.length > 0 && (
                  <span className="text-muted-foreground">
                    In {listsForThisPlace.length} list{listsForThisPlace.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span data-testid="sheet-place-address">{place.formattedAddress}</span>
              </div>
            </div>

            <PlacePhotoGrid photos={photos} maxDisplay={5} />

            {friendsWhoSaved.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex -space-x-2 flex-wrap">
                  {friendsWhoSaved.slice(0, 3).map((friend) => {
                    const displayName = friend.user.firstName || friend.user.username || "User";
                    return (
                      <Avatar key={friend.id} className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={friend.user.profileImageUrl || undefined} alt={displayName} />
                        <AvatarFallback className="text-xs">{displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    );
                  })}
                </div>
                <span className="text-sm text-muted-foreground">
                  {friendsWhoSaved.length === 1 
                    ? `${friendsWhoSaved[0].user.firstName || friendsWhoSaved[0].user.username} saved this`
                    : `${friendsWhoSaved.length} friends saved this`}
                </span>
              </div>
            )}

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="feed" data-testid="tab-feed">Feed</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="pt-4 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">About</h3>
                  <p className="text-sm text-muted-foreground">
                    A popular {placeType?.toLowerCase() || "place"} in {locationDisplay || "the area"}. 
                    Known for great ambiance and quality service. Perfect for dining with friends and family.
                  </p>
                </div>

                {listsForThisPlace.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Lists</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {listsForThisPlace.map((list) => (
                        <ListRowCard key={list.id} list={list} />
                      ))}
                    </div>
                  </div>
                )}

                {activities.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Recent Activity</h3>
                      <Button variant="ghost" size="sm" className="text-xs" asChild>
                        <Link href="#" onClick={(e) => {
                          e.preventDefault();
                          const feedTab = document.querySelector('[data-testid="tab-feed"]') as HTMLButtonElement;
                          feedTab?.click();
                        }}>
                          See all <ChevronRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <FeedPost activity={activities[0]} />
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {!myReview && onAddReview && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAddReview}
                      data-testid="sheet-button-add-review"
                    >
                      <Star className="mr-1 h-4 w-4" />
                      Add Review
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    asChild 
                    data-testid="sheet-button-open-maps"
                  >
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Google Maps
                    </a>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="feed" className="pt-4">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-activity">
                    No activity for this place yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <FeedPost key={activity.id} activity={activity} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
