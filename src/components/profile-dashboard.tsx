"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, UserMinus, Loader2, User } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { PlaceMap } from "@/components/place-map";
import { ProfilePlacesPanel } from "@/components/profile-places-panel";
import { BottomSheet } from "@/components/bottom-sheet";
import { AppShell } from "@/components/layout";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

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

interface ProfileData {
  user: UserData;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  wantPlaces: SavedPlace[];
  beenPlaces: SavedPlace[];
  allSavedPlaces: SavedPlace[];
  lists: ListData[];
  reviews: ReviewData[];
}

interface ProfileDashboardProps {
  username: string;
  currentUser: UserData | null;
  isAuthenticated: boolean;
}

function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-16 w-16 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex items-center gap-4 p-4 border-b bg-background">
      <Avatar className="h-16 w-16 border-2 border-border shrink-0">
        <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
        <AvatarFallback className="text-xl font-medium">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate" data-testid="text-profile-name">{displayName}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-profile-username">@{handle}</p>
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
        
        <div className="flex items-center gap-4 mt-2 text-sm">
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

export function ProfileDashboard({ username, currentUser, isAuthenticated }: ProfileDashboardProps) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<"places" | "feed">("places");
  const [selectedListId, setSelectedListId] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const placeRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const reviewRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { data, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["user-profile", username],
    queryFn: () => apiRequest(`/api/users/${username}`),
    enabled: isAuthenticated,
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("/api/follows", {
        method: "POST",
        body: JSON.stringify({ followingId: userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", username] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("/api/follows", {
        method: "DELETE",
        body: JSON.stringify({ followingId: userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", username] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const profileUser = data?.user;
  const isOwnProfile = data?.isOwnProfile || false;
  const isFollowing = data?.isFollowing || false;
  const followerCount = data?.followerCount || 0;
  const followingCount = data?.followingCount || 0;
  const allSavedPlaces = data?.allSavedPlaces || [];
  const lists = data?.lists || [];
  const reviews = data?.reviews || [];

  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;

  const handleFollow = () => {
    if (!profileUser) return;
    if (isFollowing) {
      unfollowMutation.mutate(profileUser.id);
    } else {
      followMutation.mutate(profileUser.id);
    }
  };

  const selectedList = selectedListId !== "all" ? lists.find((l) => l.id === selectedListId) : null;
  const selectedListPlaceIds = selectedList?.listPlaces?.map((lp) => lp.placeId) || [];

  const filteredPlaces = allSavedPlaces.filter((sp) => {
    if (selectedListId !== "all" && !selectedListPlaceIds.includes(sp.placeId)) return false;
    if (selectedStatusFilter === "want" && sp.status !== "WANT") return false;
    if (selectedStatusFilter === "been" && sp.status !== "BEEN") return false;
    return true;
  });

  const mapPlaces = selectedTab === "places" 
    ? filteredPlaces.map((sp) => ({
        id: sp.id,
        status: sp.status,
        place: sp.place,
      }))
    : reviews.map((r) => ({
        id: r.id,
        status: "BEEN" as const,
        place: r.place,
      }));

  const currentSelectedId = selectedTab === "places" ? selectedPlaceId : selectedReviewId;

  const handleMarkerClick = useCallback((id: string) => {
    if (selectedTab === "places") {
      setSelectedPlaceId(id);
      const rowElement = placeRowRefs.current.get(id);
      if (rowElement) rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setSelectedReviewId(id);
      const rowElement = reviewRowRefs.current.get(id);
      if (rowElement) rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedTab]);

  const handlePlaceSelect = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
  }, []);

  const handleReviewSelect = useCallback((reviewId: string) => {
    setSelectedReviewId(reviewId);
  }, []);

  useEffect(() => {
    setSelectedPlaceId(null);
    setSelectedReviewId(null);
  }, [selectedTab, selectedListId, selectedStatusFilter]);

  if (!isAuthenticated) {
    return (
      <AppShell user={currentUser}>
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">Please sign in</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in to view profiles</p>
          <Button asChild className="mt-4">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (error || (!isLoading && !profileUser)) {
    return (
      <AppShell user={currentUser}>
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">User not found</p>
          <p className="text-sm text-muted-foreground mt-1">This profile doesn't exist</p>
          <Button asChild className="mt-4">
            <Link href="/people">Browse People</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b md:hidden">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <ThemeToggle />
      </div>
      {isLoading || !profileUser ? (
        <ProfileSkeleton />
      ) : (
        <ProfileHeader
          user={profileUser}
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          followerCount={followerCount}
          followingCount={followingCount}
          onFollow={handleFollow}
          isFollowLoading={isFollowLoading}
        />
      )}
      <div className="flex-1 overflow-hidden">
        <ProfilePlacesPanel
          places={filteredPlaces}
          reviews={reviews}
          lists={lists}
          isLoading={isLoading}
          selectedPlaceId={selectedPlaceId}
          selectedReviewId={selectedReviewId}
          selectedTab={selectedTab}
          selectedListId={selectedListId}
          selectedStatusFilter={selectedStatusFilter}
          onTabChange={setSelectedTab}
          onListChange={setSelectedListId}
          onStatusFilterChange={setSelectedStatusFilter}
          onPlaceSelect={handlePlaceSelect}
          onReviewSelect={handleReviewSelect}
          placeRowRefs={placeRowRefs}
          reviewRowRefs={reviewRowRefs}
        />
      </div>
    </div>
  );

  return (
    <AppShell user={currentUser}>
      <div className="relative flex-1 overflow-hidden">
        <PlaceMap
          places={mapPlaces}
          selectedPlaceId={currentSelectedId}
          onMarkerClick={handleMarkerClick}
          showSettings={true}
        />

        <div className="absolute top-0 left-0 bottom-0 z-10 w-80 p-3 hidden md:block">
          <div className="h-full bg-background rounded-lg border shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 p-2 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </div>
            {isLoading || !profileUser ? (
              <ProfileSkeleton />
            ) : (
              <ProfileHeader
                user={profileUser}
                isOwnProfile={isOwnProfile}
                isFollowing={isFollowing}
                followerCount={followerCount}
                followingCount={followingCount}
                onFollow={handleFollow}
                isFollowLoading={isFollowLoading}
              />
            )}
            <div className="flex-1 overflow-hidden">
              <ProfilePlacesPanel
                places={filteredPlaces}
                reviews={reviews}
                lists={lists}
                isLoading={isLoading}
                selectedPlaceId={selectedPlaceId}
                selectedReviewId={selectedReviewId}
                selectedTab={selectedTab}
                selectedListId={selectedListId}
                selectedStatusFilter={selectedStatusFilter}
                onTabChange={setSelectedTab}
                onListChange={setSelectedListId}
                onStatusFilterChange={setSelectedStatusFilter}
                onPlaceSelect={handlePlaceSelect}
                onReviewSelect={handleReviewSelect}
                placeRowRefs={placeRowRefs}
                reviewRowRefs={reviewRowRefs}
              />
            </div>
          </div>
        </div>

        <BottomSheet defaultSnapPoint="mid">
          {sidebarContent}
        </BottomSheet>
      </div>
    </AppShell>
  );
}
