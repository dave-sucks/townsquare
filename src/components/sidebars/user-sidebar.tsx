"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserAdd01Icon, UserRemove01Icon, Loading03Icon, ArrowDown01Icon, Tick01Icon, Activity01Icon } from "@hugeicons/core-free-icons";
import { apiRequest } from "@/lib/query-client";
import { toast } from "sonner";
import { PlacesList } from "@/components/shared/places-list";
import { FeedPost } from "@/components/feed-post";
import type { SidebarInjectedProps } from "@/components/map/map-layout";

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
  placeId: string;
  hasBeen: boolean;
  rating: number | null;
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

interface ActivityData {
  id: string;
  actorId: string;
  type: "PLACE_SAVED" | "PLACE_MARKED_BEEN" | "PLACE_ADDED_TO_LIST" | "LIST_CREATED" | "REVIEW_CREATED";
  placeId: string | null;
  listId: string | null;
  metadata: { placeName?: string; listName?: string; rating?: number; note?: string; review_preview?: string } | null;
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
}

interface CurrentUserPlaceData {
  savedPlaceId: string | null;
  hasBeen: boolean;
  rating: number | null;
  lists: Array<{ id: string; name: string }>;
}

interface UserSidebarProps extends Partial<SidebarInjectedProps> {
  user: UserData;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  places: SavedPlace[];
  lists: ListData[];
  activities: ActivityData[];
  isLoading?: boolean;
  currentUserPlaceData?: Record<string, CurrentUserPlaceData> | null;
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "not_visited", label: "Not visited" },
  { value: "been", label: "Been" },
];

function ProfileHeader({
  user,
  followerCount,
  followingCount,
}: {
  user: UserData;
  followerCount: number;
  followingCount: number;
}) {
  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user.username || "User";
  
  const handle = user.username || user.id;

  return (
    <div className="flex items-center gap-3 p-3 border-b">
      <Avatar className="h-14 w-14 border-2 border-border shrink-0">
        <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
        <AvatarFallback className="text-lg font-medium">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold truncate font-brand" data-testid="text-profile-name">{displayName}</h2>
        <p className="text-xs text-muted-foreground" data-testid="text-profile-username">@{handle}</p>
        
        <div className="flex items-center gap-4 mt-1 text-xs">
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

export function UserSidebar({
  user,
  isOwnProfile,
  isFollowing,
  followerCount,
  followingCount,
  places,
  lists,
  activities,
  isLoading = false,
  selectedPlaceId,
  onPlaceSelect,
  placeRowRefs,
  currentUserPlaceData,
}: UserSidebarProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"places" | "feed">("places");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedListId, setSelectedListId] = useState<string>("all");
  const [localIsFollowing, setLocalIsFollowing] = useState(isFollowing);
  const [localFollowerCount, setLocalFollowerCount] = useState(followerCount);

  const resolvedCurrentUserPlaceData = useMemo(() => {
    if (currentUserPlaceData) return currentUserPlaceData;
    if (!isOwnProfile) return null;
    const map: Record<string, CurrentUserPlaceData> = {};
    for (const sp of places) {
      map[sp.placeId] = {
        savedPlaceId: sp.id,
        hasBeen: sp.hasBeen,
        rating: sp.rating,
        lists: [],
      };
    }
    return map;
  }, [currentUserPlaceData, isOwnProfile, places]);

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
    if (selectedStatusFilter === "not_visited") return !sp.hasBeen;
    if (selectedStatusFilter === "been") return sp.hasBeen;
    return true;
  });

  const selectedStatusLabel = statusOptions.find((o) => o.value === selectedStatusFilter)?.label || "All";
  const selectedListLabel = selectedListId === "all" 
    ? "All Lists" 
    : lists.find((l) => l.id === selectedListId)?.name || "All Lists";

  const publicLists = lists.filter(l => l.visibility === "PUBLIC" || isOwnProfile);

  const combinedFilterValue = selectedListId !== "all" ? `list:${selectedListId}` : selectedStatusFilter;
  const combinedFilterLabel = selectedListId !== "all"
    ? (lists.find(l => l.id === selectedListId)?.name || "All")
    : selectedStatusFilter === "been" ? "Places they've been" : selectedStatusLabel;

  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user.username || "User";

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-2 p-3 border-b">
          <Skeleton className="h-4 w-24 flex-1" />
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
      <div className="flex items-center gap-2 p-3 border-b shrink-0">
        <span className="font-semibold text-sm flex-1 truncate font-brand">{displayName}</span>
        {!isOwnProfile && (
          <Button
            variant={localIsFollowing ? "outline" : "default"}
            size="sm"
            onClick={handleFollow}
            disabled={followMutation.isPending}
            data-testid="button-follow"
          >
            {followMutation.isPending ? (
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
            ) : localIsFollowing ? (
              <><HugeiconsIcon icon={UserRemove01Icon} className="mr-1.5 h-4 w-4" />Following</>
            ) : (
              <><HugeiconsIcon icon={UserAdd01Icon} className="mr-1.5 h-4 w-4" />Follow</>
            )}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <ProfileHeader
          user={user}
          followerCount={localFollowerCount}
          followingCount={followingCount}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "places" | "feed")} className="flex flex-col gap-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b sticky top-0 bg-background z-10">
          <TabsList className="justify-start">
            <TabsTrigger 
              value="places" 
              data-testid="tab-places"
            >
              Places
            </TabsTrigger>
            <TabsTrigger 
              value="feed" 
              data-testid="tab-feed"
            >
              Feed
            </TabsTrigger>
          </TabsList>

          {activeTab === "places" && (
            <div className="flex gap-2">
              {!isOwnProfile ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="select-combined-filter">
                      {combinedFilterLabel}
                      <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="whitespace-nowrap min-w-[200px]">
                    <DropdownMenuItem
                      onSelect={() => { setSelectedStatusFilter("all"); setSelectedListId("all"); }}
                      data-active={combinedFilterValue === "all"}
                    >
                      All
                      <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${combinedFilterValue === "all" ? "opacity-100" : "opacity-0"}`} />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => { setSelectedStatusFilter("been"); setSelectedListId("all"); }}
                      data-active={combinedFilterValue === "been"}
                    >
                      Places they've been
                      <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${combinedFilterValue === "been" ? "opacity-100" : "opacity-0"}`} />
                    </DropdownMenuItem>
                    {publicLists.length > 0 && <DropdownMenuSeparator />}
                    {publicLists.map((list) => (
                      <DropdownMenuItem
                        key={list.id}
                        onSelect={() => { setSelectedStatusFilter("all"); setSelectedListId(list.id); }}
                        data-active={combinedFilterValue === `list:${list.id}`}
                      >
                        {list.name}
                        <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${combinedFilterValue === `list:${list.id}` ? "opacity-100" : "opacity-0"}`} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="select-status-filter">
                        {selectedStatusLabel}
                        <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {statusOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={() => setSelectedStatusFilter(option.value)}
                          data-active={selectedStatusFilter === option.value}
                        >
                          {option.label}
                          <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${selectedStatusFilter === option.value ? "opacity-100" : "opacity-0"}`} />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {publicLists.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="select-list-filter">
                          {selectedListLabel}
                          <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setSelectedListId("all")}
                          data-active={selectedListId === "all"}
                        >
                          All Lists
                          <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${selectedListId === "all" ? "opacity-100" : "opacity-0"}`} />
                        </DropdownMenuItem>
                        {publicLists.map((list) => (
                          <DropdownMenuItem
                            key={list.id}
                            onSelect={() => setSelectedListId(list.id)}
                            data-active={selectedListId === list.id}
                          >
                            {list.name}
                            <HugeiconsIcon icon={Tick01Icon} className={`ml-auto h-4 w-4 ${selectedListId === list.id ? "opacity-100" : "opacity-0"}`} />
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>
          )}
        </div>

          <TabsContent value="places" className="mt-0">
            <PlacesList
              places={filteredPlaces}
              selectedPlaceId={selectedPlaceId || null}
              onPlaceSelect={onPlaceSelect || (() => {})}
              placeRowRefs={placeRowRefs}
              showStatus={true}
              showSaveDropdown={true}
              emptyMessage="No places saved"
              emptySubMessage={isOwnProfile ? "Start saving places to see them here" : "This user hasn't saved any places yet"}
              thumbnailMode={isOwnProfile ? "my-places" : "photo"}
              currentUserPlaceData={resolvedCurrentUserPlaceData}
            />
          </TabsContent>

          <TabsContent value="feed" className="mt-0">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <HugeiconsIcon icon={Activity01Icon} className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isOwnProfile ? "Your activity will appear here" : "This user doesn't have any activity yet"}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {activities.map((activity) => (
                  <FeedPost key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
