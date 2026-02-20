"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
  Location01Icon,
  StarIcon,
  CheckmarkBadge01Icon,
  LeftToRightListBulletIcon,
  ArrowRight01Icon,
  PencilEdit01Icon,
  Delete02Icon,
  PinLocation01Icon,
  Bookmark01Icon,
} from "@hugeicons/core-free-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient, apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AppShell, PageHeader } from "@/components/layout";
import { GroupedTags, InlineTags, TagCategoryGroup, TagInfo, TagsWithPopover } from "@/components/shared/place-tags";
import { SiGooglemaps } from "react-icons/si";
import { ListChip } from "@/components/shared/list-chip";
import dynamic from "next/dynamic";

const ReviewDialog = dynamic(
  () => import("@/components/review-dialog").then(m => ({ default: m.ReviewDialog })),
);
const SaveToListDropdown = dynamic(
  () => import("@/components/shared/save-to-list-dropdown").then(m => ({ default: m.SaveToListDropdown })),
);
const FeedPost = dynamic(
  () => import("@/components/feed-post").then(m => ({ default: m.FeedPost })),
);
const EmojiPickerPopover = dynamic(
  () => import("@/components/shared/emoji-picker-popover").then(m => ({ default: m.EmojiPickerPopover })),
);

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
  aiSummary?: string | null;
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
}

interface ListData {
  id: string;
  name: string;
  visibility: "PRIVATE" | "PUBLIC";
  _count: {
    listPlaces: number;
  };
}

interface FriendSavedPlace {
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

interface Photo {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

interface Review {
  id: string;
  userId: string | null;
  placeId: string;
  rating: number;
  note: string | null;
  visitedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  photos: Photo[];
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

interface PlaceDetailData {
  place: Place;
  savedPlace: SavedPlace | null;
  listsContainingPlace: ListData[];
  friendsWhoSaved: FriendSavedPlace[];
  myReview: Review | null;
  reviews: Review[];
  photos: Photo[];
  tags?: TagCategoryGroup[];
  topTags?: TagInfo[];
  activities?: Activity[];
}

function formatPlaceType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const RATING_LABELS: Record<number, string> = {
  1: "ehh",
  2: "okay",
  3: "liked",
  4: "great",
  5: "loved",
};


function ReviewCard({ review, isOwn, onEdit, onDelete, isDeleting }: { 
  review: Review; 
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  const displayName = review.user.firstName
    ? `${review.user.firstName}${review.user.lastName ? ` ${review.user.lastName}` : ""}`
    : review.user.username || "User";
  
  return (
    <div className="p-4 rounded-lg border bg-card" data-testid={`review-${review.id}`}>
      <div className="flex items-start gap-3">
        <Link href={`/u/${review.user.username || review.user.id}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={review.user.profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Link 
                href={`/u/${review.user.username || review.user.id}`}
                className="font-medium text-sm hover:underline"
              >
                {displayName}
              </Link>
              <Badge variant="secondary" className="shrink-0">
                <HugeiconsIcon icon={StarIcon} className="mr-1 h-3 w-3 fill-current" />
                {review.rating}/10
              </Badge>
            </div>
            {isOwn && onEdit && onDelete && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  data-testid="button-edit-review"
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="hover:text-destructive"
                  data-testid="button-delete-review"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {review.note && (
            <p className="text-sm mt-2 text-muted-foreground">{review.note}</p>
          )}
          {review.photos.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {review.photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt="Review photo"
                  className="h-16 w-16 rounded-md object-cover"
                />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: placeId } = use(params);
  const { user, isAuthenticated } = useAuth();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  

  const { data, isLoading, refetch } = useQuery<PlaceDetailData>({
    queryKey: ["place-detail", placeId],
    queryFn: () => apiRequest(`/api/places/${placeId}`),
    enabled: isAuthenticated,
  });

  const place = data?.place;
  const savedPlace = data?.savedPlace;
  const listsContainingPlace = data?.listsContainingPlace || [];
  const friendsWhoSaved = data?.friendsWhoSaved || [];
  const myReview = data?.myReview;
  const reviews = data?.reviews || [];
  const photos = data?.photos || [];
  const activities = data?.activities || [];
  const tags = data?.tags || [];
  const topTags = data?.topTags || [];

  const placeType = formatPlaceType(place?.primaryType || null);
  const locationDisplay = place?.neighborhood || place?.locality || "";

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      return apiRequest(`/api/reviews/${reviewId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Review deleted!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete review");
    },
  });

  const updateEmojiMutation = useMutation({
    mutationFn: async (emoji: string | null) => {
      if (!savedPlace) return;
      return apiRequest(`/api/saved-places/${savedPlace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ emoji }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    },
  });

  const quickSaveMutation = useMutation({
    mutationFn: async () => {
      if (!place) return;
      return apiRequest("/api/saved-places", {
        method: "POST",
        body: JSON.stringify({
          googlePlaceId: place.googlePlaceId,
          name: place.name,
          formattedAddress: place.formattedAddress,
          lat: place.lat,
          lng: place.lng,
          primaryType: place.primaryType,
          types: place.types,
          priceLevel: place.priceLevel,
          photoRefs: place.photoRefs,
          hasBeen: false,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
      queryClient.invalidateQueries({ queryKey: ["saved-places"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      toast.success("Place saved!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save place");
    },
  });

  if (!isAuthenticated) {
    return (
      <AppShell user={user}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <HugeiconsIcon icon={Location01Icon} className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Please sign in</p>
          <Button asChild className="mt-4">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell user={user}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!place) {
    return (
      <AppShell user={user}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <HugeiconsIcon icon={Location01Icon} className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Place not found</p>
          <Button asChild className="mt-4">
            <Link href="/">Go to Map</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <PageHeader 
        title={place.name}
        backHref="/"
        className="border-b-0"
      >
        <SaveToListDropdown
          place={place}
          savedPlace={savedPlace ? {
            id: savedPlace.id,
            placeId: savedPlace.placeId,
            hasBeen: savedPlace.hasBeen,
            rating: savedPlace.rating,
          } : null}
          listsContainingPlace={listsContainingPlace.map(l => l.id)}
          onSaveSuccess={() => refetch()}
        />
      </PageHeader>

      <div className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 w-full max-w-2xl mx-auto pt-0">
        <div className="space-y-6">
          {/* Header: Big title, inline metadata */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {savedPlace ? (
                <EmojiPickerPopover
                  emoji={savedPlace.emoji || null}
                  onEmojiSelect={(emoji) => updateEmojiMutation.mutate(emoji)}
                  disabled={updateEmojiMutation.isPending}
                  variant="area"
                  testId="button-emoji-page"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0 cursor-pointer hover-elevate"
                  data-testid="button-save-bookmark"
                  onClick={() => quickSaveMutation.mutate()}
                >
                  <HugeiconsIcon icon={Bookmark01Icon} className={`h-5 w-5 text-muted-foreground ${quickSaveMutation.isPending ? "animate-pulse" : ""}`} />
                </div>
              )}
              <h1 className="text-xl font-bold flex items-center gap-2 font-brand" data-testid="text-place-name">
                {place.name}
                {savedPlace?.hasBeen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HugeiconsIcon icon={CheckmarkBadge01Icon} className="w-6 h-6 flex-shrink-0 fill-foreground text-background" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {savedPlace.rating ? (RATING_LABELS[savedPlace.rating] || "rated") : "Been here"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </h1>
            </div>
            
            {/* Inline metadata: category — tags, view all */}
            <TagsWithPopover 
              category={placeType || "Place"} 
              tags={topTags} 
              tagGroups={tags}
              maxInlineTags={2}
            />

            {friendsWhoSaved.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex -space-x-2">
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
          </div>

          {/* Hero Photo - after title and tags */}
          {place.photoRefs && (place.photoRefs as string[]).length > 0 ? (
            <div className="w-full aspect-[16/9] max-h-[300px] bg-muted relative overflow-hidden rounded-lg group">
              <img
                src={`/api/places/photo?photoRef=${encodeURIComponent((place.photoRefs as string[])[0])}&maxWidth=1200`}
                alt={place.name}
                className="w-full h-full object-cover"
                data-testid="page-hero-photo"
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
                  </Badge>
                </a>
              )}
            </div>
          ) : (
            <div className="w-full aspect-[16/9] max-h-[300px] bg-muted flex items-center justify-center rounded-lg">
              <HugeiconsIcon icon={Location01Icon} className="h-16 w-16 text-muted-foreground" />
            </div>
          )}

          {/* Two tabs: Overview and Feed */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="justify-start">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="feed" data-testid="tab-feed">Feed</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-0 space-y-6">
              {place?.aiSummary && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">About</h3>
                  <p className="text-base text-muted-foreground">
                    {place.aiSummary}
                  </p>
                </div>
              )}

              {(savedPlace || listsContainingPlace.length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Lists</h3>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {savedPlace && (
                      <ListChip name="All Saved Places" href="/my-places" icon="pin" />
                    )}
                    {listsContainingPlace.map((list) => (
                      <ListChip key={list.id} id={list.id} name={list.name} href={`/lists/${list.id}`} count={list._count?.listPlaces || 0} />
                    ))}
                  </div>
                </div>
              )}

              {/* 1 feed preview with "See all" link */}
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
                <div className="-mx-4">
                  {activities.map((activity) => (
                    <FeedPost key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        </div>
      </div>

      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        placeId={place.id}
        placeName={place.name}
        existingReview={myReview || undefined}
        onSuccess={() => {
          refetch();
          setReviewDialogOpen(false);
        }}
      />
    </AppShell>
  );
}
