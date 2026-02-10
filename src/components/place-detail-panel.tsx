"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
  ArrowLeft01Icon,
  Maximize01Icon,
  Location01Icon,
  CheckmarkBadge01Icon,
  LeftToRightListBulletIcon,
  ArrowRight01Icon,
  LinkSquare01Icon,
} from "@hugeicons/core-free-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SaveToListDropdown } from "./shared/save-to-list-dropdown";
import { FeedPost } from "./feed-post";
import { EmojiPickerPopover } from "./shared/emoji-picker-popover";
import { GroupedTags, InlineTags, TagCategoryGroup, TagInfo, TagsWithPopover } from "./shared/place-tags";
import { SiGooglemaps } from "react-icons/si";
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
  userId: string | null;
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
    userId: string | null;
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
  2: "okay",
  3: "liked",
  4: "great",
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
        <HugeiconsIcon icon={LeftToRightListBulletIcon} className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{list.name}</p>
        <p className="text-xs text-muted-foreground">
          {list._count?.listPlaces || 0} places
        </p>
      </div>
      <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

interface PlaceDetailResponse {
  place: Place;
  savedPlace: { id: string; hasBeen: boolean; rating: number | null; emoji?: string | null } | null;
  listsContainingPlace: ListInfo[];
  friendsWhoSaved: FriendSaved[];
  myReview: Review | null;
  photos: Photo[];
  tags: TagCategoryGroup[];
  topTags: TagInfo[];
  activities: Activity[];
  followingActivities: Activity[];
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

  // Use all activities for the place (not just following) so visitors from any profile can see them
  const activities = placeDetails?.activities || passedActivities;
  const fetchedPhotos = placeDetails?.photos || photos;
  const fetchedFriends = placeDetails?.friendsWhoSaved || friendsWhoSaved;
  const fetchedLists = placeDetails?.listsContainingPlace || listsData;
  const fetchedListIds = fetchedLists.map(l => l.id);
  const fetchedTags = placeDetails?.tags || [];
  const fetchedTopTags = placeDetails?.topTags || [];

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
      <div className="flex items-center gap-2 p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back-to-list"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            asChild
            data-testid="button-open-full-page"
          >
            <Link href={`/places/${place.googlePlaceId}`}>
              <HugeiconsIcon icon={Maximize01Icon} className="h-4 w-4" />
            </Link>
          </Button>
          <SaveToListDropdown
            place={place}
            savedPlace={placeDetails?.savedPlace ? {
              id: placeDetails.savedPlace.id,
              placeId: savedPlace.placeId,
              hasBeen: placeDetails.savedPlace.hasBeen,
              rating: placeDetails.savedPlace.rating,
            } : null}
            listsContainingPlace={fetchedListIds}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        {/* Header section with padding */}
        <div className="p-4 pt-0 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <EmojiPickerPopover
                emoji={placeDetails?.savedPlace?.emoji || null}
                onEmojiSelect={(emoji) => updateEmojiMutation.mutate(emoji)}
                disabled={updateEmojiMutation.isPending}
                variant="area"
                testId="button-emoji-panel"
              />
              <h1 className="text-xl font-bold flex items-center gap-2 font-brand" data-testid="panel-place-name">
                {place.name}
                {placeDetails?.savedPlace?.hasBeen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HugeiconsIcon icon={CheckmarkBadge01Icon} className="w-5 h-5 flex-shrink-0 fill-foreground text-background" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {placeDetails.savedPlace.rating ? (RATING_LABELS[placeDetails.savedPlace.rating] || "rated") : "Been here"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </h1>
            </div>
            
            {/* Inline metadata: category — tags, view all | price · neighborhood */}
            <TagsWithPopover 
              category={placeType || "Place"} 
              tags={fetchedTopTags} 
              tagGroups={fetchedTags}
              maxInlineTags={2}
            />
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {priceLevel && (
                <>
                  <span>{priceLevel}</span>
                </>
              )}
            </div>
          </div>

          {/* Hero Photo - after title and tags */}
          {place.photoRefs && place.photoRefs.length > 0 ? (
            <div className="w-full h-48 bg-muted relative overflow-hidden rounded-lg group">
              <img
                src={`/api/places/photo?photoRef=${encodeURIComponent(place.photoRefs[0] as string)}&maxWidth=600`}
                alt={place.name}
                className="w-full h-full object-cover object-center"
                data-testid="panel-hero-photo"
              />
              {locationDisplay && (
                <a 
                  href={`https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 left-3 no-default-hover-elevate no-default-active-elevate z-10"
                >
                  <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5 cursor-pointer bg-white/20 backdrop-blur-md border-none hover:bg-white/30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    <span className="text-white font-medium">{locationDisplay}</span>
                    <HugeiconsIcon icon={LinkSquare01Icon} className="size-3 text-white/80" />
                  </Badge>
                </a>
              )}
            </div>
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center rounded-lg">
              <HugeiconsIcon icon={Location01Icon} className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

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
            <TabsList className="justify-start">
              <TabsTrigger value="overview" data-testid="panel-tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="feed" data-testid="panel-tab-feed">Feed</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="p-4 pt-0 space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">About</h3>
              <p className="text-base text-muted-foreground">
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
                      See all <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3 ml-1" />
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
