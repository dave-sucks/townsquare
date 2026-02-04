"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft,
  Maximize,
  Utensils,
  MapPin,
  BadgeCheck,
  List as ListIcon,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SaveToListDropdown } from "./shared/save-to-list-dropdown";
import { FeedPost } from "./feed-post";
import { EmojiPickerPopover } from "./shared/emoji-picker-popover";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useMutation } from "@tanstack/react-query";

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
  emoji?: string | null;
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

interface PlaceDetailPanelProps {
  savedPlace: SavedPlace | null;
  myReview?: Review | null;
  photos?: Photo[];
  friendsWhoSaved?: FriendSaved[];
  listsContainingPlace?: string[];
  listsData?: ListInfo[];
  activities?: Activity[];
  isLoading?: boolean;
  onBack: () => void;
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
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate"
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

interface PlaceDetailResponse {
  place: Place;
  savedPlace: { id: string; hasBeen: boolean; rating: number | null } | null;
  listsContainingPlace: ListInfo[];
  friendsWhoSaved: FriendSaved[];
  myReview: Review | null;
  photos: Photo[];
  activities: Activity[];
}

export function PlaceDetailPanel({
  savedPlace,
  myReview,
  photos = [],
  friendsWhoSaved = [],
  listsContainingPlace = [],
  listsData = [],
  activities: passedActivities = [],
  isLoading = false,
  onBack,
  onDelete,
  onAddReview,
  isDeleting,
}: PlaceDetailPanelProps) {
  const updateEmojiMutation = useMutation({
    mutationFn: async (emoji: string | null) => {
      if (!savedPlace) return;
      return apiRequest(`/api/saved-places/${savedPlace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ emoji }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["place-detail"] });
    },
  });

  // Fetch full place details including activities
  const { data: placeDetails, isLoading: isLoadingDetails } = useQuery<PlaceDetailResponse>({
    queryKey: ["place-detail", savedPlace?.place?.googlePlaceId],
    queryFn: () => apiRequest(`/api/places/${savedPlace?.place?.googlePlaceId}`),
    enabled: !!savedPlace?.place?.googlePlaceId,
  });

  // Use fetched activities or fall back to passed activities
  const activities = placeDetails?.activities || passedActivities;
  const fetchedPhotos = placeDetails?.photos || photos;
  const fetchedFriends = placeDetails?.friendsWhoSaved || friendsWhoSaved;
  const fetchedLists = placeDetails?.listsContainingPlace || listsData;
  const fetchedListIds = fetchedLists.map(l => l.id);

  if (isLoading || isLoadingDetails) {
    return (
      <div className="h-full flex flex-col bg-background" data-testid="place-detail-panel-loading">
        <div className="flex items-center gap-2 p-3 border-b">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!savedPlace) return null;

  const place = savedPlace.place;
  const placeType = formatPlaceType(place.primaryType);
  const priceLevel = formatPriceLevel(place.priceLevel);
  
  const locationDisplay = place.neighborhood || place.locality || "";
  const listsForThisPlace = fetchedLists;

  return (
    <div className="h-full flex flex-col bg-background" data-testid="place-detail-panel">
      <div className="flex items-center gap-2 p-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            asChild
            data-testid="button-open-full-page"
          >
            <Link href={`/places/${place.googlePlaceId}`}>
              <Maximize className="h-4 w-4" />
            </Link>
          </Button>
          <SaveToListDropdown
            place={place}
            savedPlace={{
              id: savedPlace.id,
              placeId: savedPlace.placeId,
              hasBeen: savedPlace.hasBeen,
              rating: savedPlace.rating,
            }}
            listsContainingPlace={fetchedListIds}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* Hero Photo */}
        {place.photoRefs && place.photoRefs.length > 0 ? (
          <div className="w-full h-48 bg-muted relative overflow-hidden">
            <img
              src={`/api/places/photo?photoRef=${encodeURIComponent(place.photoRefs[0] as string)}&maxWidth=600`}
              alt={place.name}
              className="w-full h-full object-cover object-center"
              data-testid="panel-hero-photo"
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-muted flex items-center justify-center">
            <MapPin className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Header section with padding */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <EmojiPickerPopover
                emoji={savedPlace.emoji || null}
                onEmojiSelect={(emoji) => updateEmojiMutation.mutate(emoji)}
                disabled={updateEmojiMutation.isPending}
                variant="area"
                testId="button-emoji-panel"
              />
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="panel-place-name">
                {place.name}
                {savedPlace.hasBeen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <BadgeCheck className="w-5 h-5 flex-shrink-0 fill-foreground text-background" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {savedPlace.rating ? RATING_LABELS[savedPlace.rating] : "Been here"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </h1>
            </div>
            
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

            <a 
              href={`https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-1" data-testid="panel-place-address">{place.formattedAddress}</span>
            </a>
          </div>

          {fetchedFriends.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex -space-x-2 flex-wrap">
                {fetchedFriends.slice(0, 3).map((friend) => {
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
                {fetchedFriends.length === 1 
                  ? `${fetchedFriends[0].user.firstName || fetchedFriends[0].user.username} saved this`
                  : `${fetchedFriends.length} friends saved this`}
              </span>
            </div>
          )}
        </div>

        {/* Tabs section - manages its own padding per tab */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="px-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview" data-testid="panel-tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="feed" data-testid="panel-tab-feed">Feed</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="p-4 pt-4 space-y-6">
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
                <div className="flex flex-col gap-2">
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
                      const feedTab = document.querySelector('[data-testid="panel-tab-feed"]') as HTMLButtonElement;
                      feedTab?.click();
                    }}>
                      See all <ChevronRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="-mx-4">
                  <FeedPost activity={activities[0]} />
                </div>
              </div>
            )}

          </TabsContent>

          <TabsContent value="feed" className="pt-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4" data-testid="text-no-activity">
                No activity for this place yet.
              </p>
            ) : (
              <div>
                {activities.map((activity) => (
                  <FeedPost key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
