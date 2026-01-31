"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserPlus, UserMinus, Loader2, ChevronDown, Check, Star } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { PlacesList } from "@/components/shared/places-list";
import type { SidebarInjectedProps } from "@/components/map/map-layout";
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

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface UserSidebarProps extends Partial<SidebarInjectedProps> {
  user: UserData;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  places: SavedPlace[];
  lists: ListData[];
  reviews: ReviewData[];
  isLoading?: boolean;
  onReviewSelect?: (reviewId: string) => void;
  selectedReviewId?: string | null;
  reviewRowRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "want", label: "Want" },
  { value: "been", label: "Been" },
];

function ProfileHeader({
  user,
  isOwnProfile,
  isFollowing,
  followerCount,
  followingCount,
  onFollow,
  isFollowLoading,
}: {
  user: UserData;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  onFollow: () => void;
  isFollowLoading: boolean;
}) {
  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user.username || "User";
  
  const handle = user.username || user.id;

  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar className="h-14 w-14 border-2 border-border shrink-0">
        <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
        <AvatarFallback className="text-lg font-medium">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate" data-testid="text-profile-name">{displayName}</h2>
            <p className="text-xs text-muted-foreground" data-testid="text-profile-username">@{handle}</p>
          </div>
          
          {!isOwnProfile && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              onClick={onFollow}
              disabled={isFollowLoading}
              data-testid="button-follow"
            >
              {isFollowLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                <><UserMinus className="mr-1.5 h-4 w-4" />Following</>
              ) : (
                <><UserPlus className="mr-1.5 h-4 w-4" />Follow</>
              )}
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-4 mt-2 text-xs">
          <button className="hover:underline" data-testid="text-following">
            <span className="font-semibold">{followingCount}</span>
            <span className="text-muted-foreground ml-1">following</span>
          </button>
          <button className="hover:underline" data-testid="text-followers">
            <span className="font-semibold">{followerCount}</span>
            <span className="text-muted-foreground ml-1">{followerCount === 1 ? "follower" : "followers"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  isSelected,
  onSelect,
  ref,
}: {
  review: ReviewData;
  isSelected: boolean;
  onSelect: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const photoRef = review.place.photoRefs?.[0];
  const photoUrl = photoRef 
    ? `/api/places/photo?photoRef=${encodeURIComponent(photoRef)}&maxWidth=100`
    : null;

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors hover-elevate",
        isSelected && "bg-accent"
      )}
      onClick={onSelect}
      data-testid={`review-card-${review.id}`}
      data-selected={isSelected}
    >
      <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={review.place.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Star className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <h3 className="font-medium text-sm truncate">{review.place.name}</h3>
        <div className="flex items-center gap-1 mt-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                "h-3 w-3",
                star <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
              )}
            />
          ))}
        </div>
        {review.note && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {review.note}
          </p>
        )}
      </div>
    </div>
  );
}

export function UserSidebar({
  user,
  isOwnProfile,
  isFollowing,
  followerCount,
  followingCount,
  places,
  lists,
  reviews,
  isLoading = false,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  onReviewSelect,
  selectedReviewId,
  reviewRowRefs,
}: UserSidebarProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"places" | "feed">("places");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedListId, setSelectedListId] = useState<string>("all");
  const [localIsFollowing, setLocalIsFollowing] = useState(isFollowing);
  const [localFollowerCount, setLocalFollowerCount] = useState(followerCount);

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("/api/follows", {
        method: "POST",
        body: JSON.stringify({ followingId: userId }),
      });
    },
    onSuccess: () => {
      const wasFollowing = localIsFollowing;
      setLocalIsFollowing(!wasFollowing);
      setLocalFollowerCount(prev => wasFollowing ? prev - 1 : prev + 1);
      queryClient.invalidateQueries({ queryKey: ["user-profile", user.username] });
      toast.success(wasFollowing ? "Unfollowed" : "Following");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update follow status"),
  });

  const handleFollow = () => {
    followMutation.mutate(user.id);
  };

  const selectedList = lists.find(l => l.id === selectedListId);
  const selectedListPlaceIds = selectedList?.listPlaces?.map(lp => lp.placeId) || [];

  const filteredPlaces = places.filter((sp) => {
    if (selectedListId !== "all" && !selectedListPlaceIds.includes(sp.placeId)) {
      return false;
    }
    if (selectedStatusFilter === "want") return sp.status === "WANT";
    if (selectedStatusFilter === "been") return sp.status === "BEEN";
    return true;
  });

  const selectedStatusLabel = statusOptions.find((o) => o.value === selectedStatusFilter)?.label || "All";
  const selectedListLabel = selectedListId === "all" 
    ? "All Lists" 
    : lists.find((l) => l.id === selectedListId)?.name || "All Lists";

  const publicLists = lists.filter(l => l.visibility === "PUBLIC" || isOwnProfile);

  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user.username || "User";

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-2 p-3 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-3 p-3 border-b">
          <Skeleton className="h-14 w-14 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background" data-testid="user-sidebar">
      <div className="flex items-center gap-2 p-3 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="font-semibold text-sm flex-1 truncate">{displayName}</h1>
      </div>

      <div className="border-b">
        <ProfileHeader
          user={user}
          isOwnProfile={isOwnProfile}
          isFollowing={localIsFollowing}
          followerCount={localFollowerCount}
          followingCount={followingCount}
          onFollow={handleFollow}
          isFollowLoading={followMutation.isPending}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "places" | "feed")} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger 
            value="places" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
            data-testid="tab-places"
          >
            Places
          </TabsTrigger>
          <TabsTrigger 
            value="feed" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
            data-testid="tab-feed"
          >
            Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="places" className="flex-1 flex flex-col min-h-0 mt-0">
          <div className="flex gap-2 p-3 border-b">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="select-status-filter">
                  {selectedStatusLabel}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statusOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => setSelectedStatusFilter(option.value)}
                    data-active={selectedStatusFilter === option.value}
                  >
                    {option.label}
                    <Check className={`ml-auto h-4 w-4 ${selectedStatusFilter === option.value ? "opacity-100" : "opacity-0"}`} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {publicLists.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="select-list-filter">
                    {selectedListLabel}
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onSelect={() => setSelectedListId("all")}
                    data-active={selectedListId === "all"}
                  >
                    All Lists
                    <Check className={`ml-auto h-4 w-4 ${selectedListId === "all" ? "opacity-100" : "opacity-0"}`} />
                  </DropdownMenuItem>
                  {publicLists.map((list) => (
                    <DropdownMenuItem
                      key={list.id}
                      onSelect={() => setSelectedListId(list.id)}
                      data-active={selectedListId === list.id}
                    >
                      {list.name}
                      <Check className={`ml-auto h-4 w-4 ${selectedListId === list.id ? "opacity-100" : "opacity-0"}`} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <PlacesList
              places={filteredPlaces}
              selectedPlaceId={selectedPlaceId || null}
              onPlaceSelect={onPlaceSelect || (() => {})}
              placeRowRefs={placeRowRefs}
              showStatus={true}
              emptyMessage="No places saved"
              emptySubMessage={isOwnProfile ? "Start saving places to see them here" : "This user hasn't saved any places yet"}
            />
          </div>
        </TabsContent>

        <TabsContent value="feed" className="flex-1 overflow-y-auto mt-0">
          {reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Star className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">No reviews yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isOwnProfile ? "Write your first review" : "This user hasn't written any reviews yet"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  isSelected={review.id === selectedReviewId}
                  onSelect={() => onReviewSelect?.(review.id)}
                  ref={(el) => {
                    if (reviewRowRefs) {
                      if (el) reviewRowRefs.current.set(review.id, el);
                      else reviewRowRefs.current.delete(review.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
